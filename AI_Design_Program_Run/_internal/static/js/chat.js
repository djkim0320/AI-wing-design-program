/**
 * 梨꾪똿 UI 愿由?紐⑤뱢
 */

const Chat = {
    messagesContainer: null,
    form: null,
    input: null,
    sendBtn: null,
    isLoading: false,
    welcomeHTML: '',
    onDesignComplete: null,

    init(onDesignComplete) {
        this.messagesContainer = document.getElementById('chatMessages');
        this.form = document.getElementById('chatForm');
        this.input = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.onDesignComplete = onDesignComplete;
        this.welcomeHTML = this.messagesContainer ? this.messagesContainer.innerHTML : '';

        // ?대깽??由ъ뒪??
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.input.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.input.addEventListener('input', () => this.autoResize());

        // ??λ맂 ?몄뀡 遺덈윭?ㅺ린
        this.loadSession();
    },

    async loadSession() {
        try {
            const response = await fetch('/api/session');
            const data = await response.json();

            if (data.has_session) {
                this.setMessages(data.messages || []);

                console.log(`?몄뀡 蹂듭썝: ${(data.messages || []).length}媛?硫붿떆吏`);

                // ?ㅺ퀎 ?곗씠?곌? ?덉쑝硫?3D 紐⑤뜽 蹂듭썝
                const designData = data.design_snapshot?.design_data || data.design_data;
                if (designData && this.onDesignComplete) {
                    setTimeout(() => {
                        this.onDesignComplete(designData, {
                            snapshot: data.design_snapshot,
                            skipPersist: true,
                            autoHistory: false
                        });
                    }, 500);
                }
            }
        } catch (error) {
            console.error('세션 불러오기 실패:', error);
        }
    },

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.form.dispatchEvent(new Event('submit'));
        }
    },

    autoResize() {
        this.input.style.height = 'auto';
        this.input.style.height = Math.min(this.input.scrollHeight, 120) + 'px';
    },

    async handleSubmit(e) {
        e.preventDefault();

        const message = this.input.value.trim();
        if (!message || this.isLoading) return;

        // ?ъ슜??硫붿떆吏 異붽?
        this.addMessage(message, 'user');
        this.input.value = '';
        this.input.style.height = 'auto';

        // 濡쒕뵫 ?곹깭
        this.setLoading(true);
        this.addTypingIndicator();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            this.removeTypingIndicator();

            if (data.error) {
                this.addMessage(`오류가 발생했습니다: ${data.error}`, 'assistant');
            } else {
                this.addMessage(data.response, 'assistant');

                // ?ㅺ퀎 ?꾨즺 ??肄쒕갚 ?몄텧
                if (data.design_data && this.onDesignComplete) {
                    this.onDesignComplete(data.design_data, {
                        snapshot: data.optimization_snapshot || null,
                        optimization: data.optimization || null,
                        autoHistory: true
                    });
                }
            }
        } catch (error) {
            this.removeTypingIndicator();
            this.addMessage('서버와 통신 중 오류가 발생했습니다.', 'assistant');
            console.error('Chat error:', error);
        } finally {
            this.setLoading(false);
        }
    },

    addMessage(content, role) {
        const textContent = String(content ?? '');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        const avatarSvg = role === 'assistant'
            ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.06-7.44 7-7.93v15.86zm2-15.86c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93V4.07z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg>';

        // JSON 釉붾줉 ?쒓굅 (梨꾪똿李쎌뿉 ?쒖떆?섏? ?딆쓬)
        let cleanContent = this.removeJsonBlocks(textContent);

        // Markdown 蹂??(媛꾨떒??泥섎━)
        const formattedContent = this.formatMarkdown(cleanContent);

        messageDiv.innerHTML = `
            <div class="message-avatar">${avatarSvg}</div>
            <div class="message-content">${formattedContent}</div>
        `;

        this.messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
    },

    removeJsonBlocks(text) {
        // ```json 肄붾뱶 釉붾줉 ?쒓굅
        text = text.replace(/```json\s*[\s\S]*?```/g, '');

        // 肄붾뱶 釉붾줉 ?놁씠 異쒕젰??design_complete JSON ?쒓굅
        text = text.replace(/\{\s*"design_complete"\s*:\s*true[\s\S]*?\n\}/g, '');

        // "### 2. 理쒖쥌 ?ㅺ퀎??(JSON)" 媛숈? ?ㅻ뜑???쒓굅
        text = text.replace(/#{1,3}\s*\d*\.?\s*理쒖쥌\s*?ㅺ퀎??\s*\(?\s*JSON\s*\)?/gi, '');

        // ?곗냽??鍮?以??뺣━
        text = text.replace(/\n{3,}/g, '\n\n');

        return text.trim();
    },

    formatMarkdown(text) {
        // HTML ?댁뒪耳?댄봽 (XSS 諛⑹?)
        text = this.escapeHtml(text);

        // 코드 블록 변환
        text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

        // ?몃씪??肄붾뱶
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

        // 蹂쇰뱶
        text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

        // ?댄깶由?
        text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 以꾨컮轅?
        text = text.replace(/\n/g, '<br>');

        // 臾몃떒 遺꾨━
        const paragraphs = text.split('<br><br>');
        return paragraphs.map(p => `<p>${p}</p>`).join('');
    },

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    addTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'typingIndicator';
        indicator.className = 'message assistant';
        indicator.innerHTML = `
            <div class="message-avatar">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.94-.49-7-3.85-7-7.93s3.06-7.44 7-7.93v15.86zm2-15.86c3.94.49 7 3.85 7 7.93s-3.06 7.44-7 7.93V4.07z"/>
                </svg>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        `;
        this.messagesContainer.appendChild(indicator);
        this.scrollToBottom();
    },

    removeTypingIndicator() {
        const indicator = document.getElementById('typingIndicator');
        if (indicator) indicator.remove();
    },

    setLoading(loading) {
        this.isLoading = loading;
        this.sendBtn.disabled = loading;
        this.input.disabled = loading;

        if (loading) {
            this.form.classList.add('loading');
        } else {
            this.form.classList.remove('loading');
        }
    },

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    },

    setMessages(messages) {
        if (!this.messagesContainer) return;

        this.messagesContainer.innerHTML = '';

        if (!messages || messages.length === 0) {
            this.messagesContainer.innerHTML = this.welcomeHTML;
            return;
        }

        messages.forEach(msg => {
            this.addMessage(msg.content || '', msg.role || 'assistant');
        });
    },

    async reset() {
        try {
            await fetch('/api/reset', { method: 'POST' });
            this.setMessages([]);
        } catch (error) {
            console.error('Reset error:', error);
        }
    }
};


