const API_URL = '/api/tickets';
const PAGE_SIZE = 100;
const AUTO_REFRESH_MS = 60000;

const STATUSES = [
    { value: 'all', label: 'All' },
    { value: 'open', label: 'Open' },
    { value: 'in_progress', label: 'In progress' },
    { value: 'resolved', label: 'Resolved' },
    { value: 'closed', label: 'Closed' }
];

const TYPE_LABELS = {
    bug: 'Bug',
    feature: 'Feature',
    enhancement: 'Enhancement',
    documentation: 'Docs'
};

const state = {
    tickets: [],
    total: 0,
    status: 'all',
    query: '',
    openIds: new Set(),
    error: null,
    loaded: false
};

// DOM Elements
const listEl = document.getElementById('list');
const filtersEl = document.getElementById('filters');
const summaryEl = document.getElementById('summary');
const searchEl = document.getElementById('search');
const moreBtn = document.getElementById('moreBtn');
const refreshBtn = document.getElementById('refreshBtn');
const copyBtn = document.getElementById('copyBtn');
const endpointEl = document.getElementById('endpointUrl');

const endpointUrl = window.location.origin + API_URL;
endpointEl.textContent = endpointUrl;

// Build DOM nodes without innerHTML so ticket data is never parsed as HTML
function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null) continue;
        if (key === 'className') node.className = value;
        else if (key === 'text') node.textContent = value;
        else node.setAttribute(key, value);
    }
    for (const child of children) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child);
    }
    return node;
}

// Only allow http(s) links so a posted ticket can't inject javascript: URLs
function safeUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
}

function formatDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || '');
    if (!match) return value || '—';
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit'
    });
}

function formatSize(bytes) {
    const size = Number(bytes);
    if (!Number.isFinite(size)) return '';
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(status) {
    return STATUSES.find((s) => s.value === status)?.label || status;
}

// Fetch tickets
async function loadTickets({ append = false } = {}) {
    const offset = append ? state.tickets.length : 0;
    const limit = append ? PAGE_SIZE : Math.max(PAGE_SIZE, state.tickets.length);

    refreshBtn.disabled = true;
    moreBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}?limit=${limit}&offset=${offset}`);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.message || `The server responded with ${response.status}`);
        }

        state.tickets = append ? state.tickets.concat(data.tickets) : data.tickets;
        state.total = data.total;
        state.error = null;
    } catch (error) {
        state.error = error.message;
    } finally {
        state.loaded = true;
        refreshBtn.disabled = false;
        moreBtn.disabled = false;
        render();
    }
}

function matchesFilters(ticket) {
    if (state.status !== 'all' && ticket.status !== state.status) return false;
    if (!state.query) return true;

    const haystack = [
        ticket.ticket_no, ticket.module, ticket.submodule, ticket.platform,
        ticket.reporter_name, ticket.project_name, ticket.current_state
    ].join(' ').toLowerCase();

    return haystack.includes(state.query);
}

// Render
function render() {
    renderFilters();

    listEl.replaceChildren();
    moreBtn.hidden = true;

    if (state.error && state.tickets.length === 0) {
        summaryEl.textContent = '';
        listEl.append(
            el('div', { className: 'notice notice-error' },
                el('h2', { text: 'Tickets could not be loaded' }),
                el('p', { text: state.error }),
                retryButton()
            )
        );
        return;
    }

    if (state.tickets.length === 0) {
        summaryEl.textContent = '';
        listEl.append(
            el('div', { className: 'notice' },
                el('h2', { text: 'No tickets yet' }),
                el('p', { text: 'Tickets show up here as soon as another system sends one to the POST URL above.' })
            )
        );
        return;
    }

    const visible = state.tickets.filter(matchesFilters);

    summaryEl.textContent = state.error
        ? `Showing saved results. Refresh failed: ${state.error}`
        : `Showing ${visible.length} of ${state.total} ticket${state.total === 1 ? '' : 's'}`;

    if (visible.length === 0) {
        listEl.append(
            el('div', { className: 'notice' },
                el('h2', { text: 'No tickets match these filters' }),
                clearFiltersButton()
            )
        );
    } else {
        listEl.append(...visible.map(ticketCard));
    }

    moreBtn.hidden = state.tickets.length >= state.total;
}

function renderFilters() {
    const counts = { all: state.tickets.length };
    for (const ticket of state.tickets) {
        counts[ticket.status] = (counts[ticket.status] || 0) + 1;
    }

    filtersEl.replaceChildren(
        ...STATUSES.map(({ value, label }) => {
            const chip = el('button', {
                className: 'chip',
                type: 'button',
                'aria-pressed': String(state.status === value)
            }, label, el('span', { className: 'chip-count', text: String(counts[value] || 0) }));

            chip.addEventListener('click', () => {
                state.status = value;
                render();
            });
            return chip;
        })
    );
}

function ticketCard(ticket) {
    const details = el('details', { className: 'ticket' });
    details.open = state.openIds.has(ticket.id);
    details.addEventListener('toggle', () => {
        if (details.open) state.openIds.add(ticket.id);
        else state.openIds.delete(ticket.id);
    });

    const summary = el('summary', { className: 'ticket-summary' },
        el('div', { className: 'stub' },
            el('span', { className: 'stub-no', text: ticket.ticket_no }),
            el('span', {
                className: `stub-type type-${ticket.type}`,
                text: TYPE_LABELS[ticket.type] || ticket.type
            })
        ),
        el('div', { className: 'ticket-main' },
            el('div', { className: 'ticket-head' },
                el('h2', { className: 'ticket-title' },
                    ticket.module,
                    el('span', { className: 'crumb-sep', 'aria-hidden': 'true', text: '›' }),
                    ticket.submodule
                ),
                el('span', { className: `pill status-${ticket.status}`, text: statusLabel(ticket.status) })
            ),
            el('p', { className: 'ticket-excerpt', text: ticket.current_state }),
            el('p', { className: 'ticket-meta' },
                el('span', {}, el('strong', { text: ticket.project_name || 'Unknown project' }), ` · ${ticket.platform}`),
                el('span', { text: `Reported by ${ticket.reporter_name} (${ticket.reporter_role})` }),
                el('span', { text: `Detected ${formatDate(ticket.date_detected)}` })
            )
        )
    );

    details.append(summary, ticketBody(ticket));
    return details;
}

function ticketBody(ticket) {
    const field = (label, value) => el('div', { className: 'field' },
        el('dt', { text: label }),
        el('dd', { text: value })
    );

    const fields = el('dl', { className: 'fields' },
        field('Current state', ticket.current_state),
        field('Desired state', ticket.desired_state),
        field('Purpose', ticket.purpose),
        ticket.remarks ? field('Remarks', ticket.remarks) : null
    );

    const links = el('div', { className: 'links' });

    const pageUrl = safeUrl(ticket.page_url);
    links.append(
        el('div', {},
            el('p', { className: 'links-label', text: 'Page' }),
            pageUrl
                ? el('a', { href: pageUrl, target: '_blank', rel: 'noopener noreferrer', text: ticket.page_url })
                : el('span', { text: ticket.page_url || '—' })
        )
    );

    const evidence = ticket.evidence || [];
    if (evidence.length > 0) {
        links.append(
            el('div', {},
                el('p', { className: 'links-label', text: `Evidence (${evidence.length})` }),
                el('ul', { className: 'evidence-list' },
                    ...evidence.map((item) => {
                        const url = safeUrl(item.url);
                        return el('li', {},
                            url
                                ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: item.name })
                                : el('span', { text: item.name }),
                            el('span', { className: 'evidence-size', text: formatSize(item.size) })
                        );
                    })
                )
            )
        );
    }

    return el('div', { className: 'ticket-body' },
        fields,
        links,
        el('p', { className: 'received', text: `Received ${formatDateTime(ticket.created_at)}` })
    );
}

function retryButton() {
    const button = el('button', { className: 'btn', type: 'button', text: 'Try again' });
    button.addEventListener('click', () => loadTickets());
    return button;
}

function clearFiltersButton() {
    const button = el('button', { className: 'btn', type: 'button', text: 'Clear filters' });
    button.addEventListener('click', () => {
        state.status = 'all';
        state.query = '';
        searchEl.value = '';
        render();
    });
    return button;
}

// Event Listeners
searchEl.addEventListener('input', () => {
    state.query = searchEl.value.trim().toLowerCase();
    render();
});

refreshBtn.addEventListener('click', () => loadTickets());
moreBtn.addEventListener('click', () => loadTickets({ append: true }));

copyBtn.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(endpointUrl);
        copyBtn.textContent = 'Copied';
    } catch {
        copyBtn.textContent = 'Copy failed';
    }
    setTimeout(() => { copyBtn.textContent = 'Copy URL'; }, 2000);
});

setInterval(() => {
    if (document.visibilityState === 'visible') loadTickets();
}, AUTO_REFRESH_MS);

loadTickets();
