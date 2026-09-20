(function () {
    const root = document.querySelector('.posts-index');
    const filters = root && root.querySelector('.topic-filters');
    const searchBox = root && root.querySelector('.posts-search-box');
    const searchInput = root && root.querySelector('#posts-search-input');
    const list = root && root.querySelector('#posts-list');
    const source = document.getElementById('all-posts-template');
    const status = root && root.querySelector('.posts-filter-status');
    const serverFoot = root && root.querySelector('.server-posts-foot');
    const clientPager = root && root.querySelector('.client-pagination');
    if (!root || !filters || !list || !status || !serverFoot || !clientPager) return;

    if (!source) {
        filters.hidden = false;
        filters.addEventListener('click', function (event) {
            const button = event.target.closest('[data-topic]');
            if (!button) return;
            const suffix = button.dataset.topic === 'all' ? '' : '?topic=' + encodeURIComponent(button.dataset.topic);
            window.location.assign(root.dataset.postsBase + suffix);
        });
        return;
    }

    const pageSize = 10;
    const normalize = value => (value || '').normalize('NFKC').trim().toLowerCase();
    const topics = Array.from(filters.querySelectorAll('[data-topic]')).map(button => ({
        button,
        slug: button.dataset.topic,
        aliases: button.dataset.aliases.split('||').filter(Boolean).map(normalize)
    }));
    list.replaceChildren(source.content.cloneNode(true));
    const articles = Array.from(list.querySelectorAll('.posts-list-item'));
    if (searchBox) searchBox.hidden = false;
    filters.hidden = false;
    status.hidden = false;
    serverFoot.hidden = true;
    clientPager.hidden = false;

    let activeTopic = 'all';
    let activePage = 1;
    let searchQuery = '';

    function readLocation() {
        const params = new URLSearchParams(window.location.search);
        const requestedTopic = params.get('topic') || 'all';
        activeTopic = topics.some(topic => topic.slug === requestedTopic) ? requestedTopic : 'all';
        activePage = Math.max(1, Number.parseInt(params.get('page') || '1', 10) || 1);
        const requestedQuery = params.get('q') || '';
        searchQuery = normalize(requestedQuery);
        if (searchInput && searchInput.value !== requestedQuery) {
            searchInput.value = requestedQuery;
        }
    }

    function writeLocation(replace) {
        const params = new URLSearchParams();
        if (activeTopic !== 'all') params.set('topic', activeTopic);
        if (searchQuery && searchInput) params.set('q', searchInput.value.trim());
        if (activePage > 1) params.set('page', String(activePage));
        const query = params.toString();
        const method = replace ? 'replaceState' : 'pushState';
        window.history[method]({}, '', root.dataset.postsBase + (query ? '?' + query : ''));
    }

    function matches(article, topic, query) {
        if (topic && topic.slug !== 'all') {
            const terms = (article.dataset.tags + '||' + article.dataset.categories)
                .split('||').filter(Boolean).map(normalize);
            if (!topic.aliases.some(alias => terms.includes(alias))) return false;
        }
        if (query) {
            const text = normalize(article.textContent + ' ' + (article.dataset.tags || '') + ' ' + (article.dataset.categories || ''));
            if (!text.includes(query)) return false;
        }
        return true;
    }

    function pageButton(label, page, options) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'client-page-button';
        button.textContent = label;
        button.disabled = Boolean(options && options.disabled);
        if (options && options.current) button.setAttribute('aria-current', 'page');
        button.addEventListener('click', function () {
            activePage = page;
            writeLocation();
            render(true);
        });
        return button;
    }

    function pageEllipsis() {
        const ellipsis = document.createElement('span');
        ellipsis.textContent = '…';
        ellipsis.setAttribute('aria-hidden', 'true');
        return ellipsis;
    }

    function render(shouldScroll) {
        const topic = topics.find(item => item.slug === activeTopic) || topics[0];
        const matching = articles.filter(article => matches(article, topic, searchQuery));
        const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
        activePage = Math.min(activePage, pageCount);
        const start = (activePage - 1) * pageSize;
        const end = Math.min(start + pageSize, matching.length);
        articles.forEach(article => { article.hidden = true; });
        matching.slice(start, end).forEach(article => { article.hidden = false; });
        topics.forEach(item => item.button.setAttribute('aria-pressed', String(item.slug === activeTopic)));

        if (searchQuery) {
            const scope = topic.slug === 'all' ? '' : `${topic.button.textContent}内`;
            status.textContent = matching.length
                ? `${scope}搜索 "${searchInput.value.trim()}"：找到 ${matching.length} 篇（显示 ${start + 1}–${end} 篇）`
                : `${scope}搜索 "${searchInput.value.trim()}"：未找到匹配文章`;
        } else {
            status.textContent = matching.length
                ? topic.slug === 'all'
                    ? `显示 ${start + 1}–${end} / ${matching.length} 篇`
                    : `${topic.button.textContent}：显示 ${start + 1}–${end} / ${matching.length} 篇`
                : `${topic.button.textContent}：暂无文章`;
        }

        clientPager.replaceChildren();
        if (matching.length > pageSize) {
            clientPager.append(pageButton('上一页', activePage - 1, { disabled: activePage === 1 }));
            const pages = Array.from(new Set([1, activePage - 2, activePage - 1, activePage, activePage + 1, activePage + 2, pageCount]))
                .filter(page => page >= 1 && page <= pageCount)
                .sort((a, b) => a - b);
            pages.forEach(function (page, index) {
                if (index > 0 && page - pages[index - 1] > 1) clientPager.append(pageEllipsis());
                clientPager.append(pageButton(String(page), page, { current: page === activePage }));
            });
            clientPager.append(pageButton('下一页', activePage + 1, { disabled: activePage === pageCount }));
        }
        clientPager.hidden = matching.length <= pageSize;
        list.classList.toggle('posts-empty', matching.length === 0);
        if (shouldScroll) status.scrollIntoView({ block: 'start' });
    }

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            searchQuery = normalize(this.value);
            activePage = 1;
            writeLocation(true);
            render(false);
        });
    }

    filters.addEventListener('click', function (event) {
        const button = event.target.closest('[data-topic]');
        if (!button || button.dataset.topic === activeTopic) return;
        activeTopic = button.dataset.topic;
        activePage = 1;
        writeLocation();
        render(false);
    });
    window.addEventListener('popstate', function () { readLocation(); render(false); });
    readLocation();
    render(false);
})();
