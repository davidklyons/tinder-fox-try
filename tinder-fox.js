/**
 * Copyright 2025 davidklyons
 * @license Apache-2.0, see LICENSE for full text.
 */
import { LitElement, html, css } from "lit";
import { DDDSuper } from "@haxtheweb/d-d-d/d-d-d.js";
import { I18NMixin } from "@haxtheweb/i18n-manager/lib/I18NMixin.js";

/**
 * tinder-fox
 *
 * @element tinder-fox
 */
export class TinderFox extends DDDSuper(I18NMixin(LitElement)) {
  static get tag() {
    return "tinder-fox";
  }

  static get properties() {
    return {
      ...super.properties,
      photos: { type: Array },
      loading: { type: Boolean },
      // UI state
      showModal: { type: Boolean },
      modalData: { type: Object },
    };
  }

  constructor() {
    super();
    this.photos = [];
    this.loading = true;
    this.showModal = false;
    this.modalData = null;
    this._observer = null;

    // restore like/dislike lists (IDs) and saved photos state if present
    this._savedStatuses = JSON.parse(localStorage.getItem("tinder-statuses") || "null");
    this._savedPhotos = JSON.parse(localStorage.getItem("tinder-photos") || "null");
  }

  connectedCallback() {
    super.connectedCallback && super.connectedCallback();
  }

  disconnectedCallback() {
    // disconnect observer if present
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }
    super.disconnectedCallback && super.disconnectedCallback();
  }

  async firstUpdated() {
    // load JSON (local or endpoint). Check your /data/photos.json file.
    try {
      const res = await fetch("./data/photos.json");
      const data = await res.json();
      // Build photos array; if saved counts exist, use them
      this.photos = (data.photos || []).map((p) => {
        // clone to avoid mutating original JSON references
        const copy = {
          id: p.id,
          name: p.name,
          date: p.date,
          thumbnail: p.thumbnail,
          full: p.full,
          author: p.author || {},
          // prefer persisted counts if they exist
          likes: (this._savedPhotos && this._savedPhotos.find(s => s.id === p.id)?.likes) ?? (p.likes ?? Math.floor(Math.random() * 300) + 50),
          dislikes: (this._savedPhotos && this._savedPhotos.find(s => s.id === p.id)?.dislikes) ?? (p.dislikes ?? Math.floor(Math.random() * 60)),
          // status: 'liked' | 'disliked' | null (persisted separately)
          status: (this._savedStatuses && this._savedStatuses[p.id]) ? this._savedStatuses[p.id] : null,
        };
        return copy;
      });

      // if statuses were saved in an object keyed by id, apply them (already applied above)
      // mark loading false and set up lazy observer
      this.loading = false;

      // small delay to ensure DOM nodes present, then set up intersection observer
      this.updateComplete.then(() => this._setupObserver());
    } catch (e) {
      console.error("Error loading photos.json:", e);
      this.loading = false;
    }
  }

  // IntersectionObserver to lazy-load full images when card enters viewport
  _setupObserver() {
    if (this._observer) {
      this._observer.disconnect();
      this._observer = null;
    }

    const options = {
      root: this.renderRoot.querySelector(".gallery"),
      rootMargin: "200px",
      threshold: 0.15,
    };

    this._observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const card = entry.target;
          const idx = Number(card.getAttribute("data-idx"));
          const photo = this.photos[idx];
          if (photo) {
            const img = card.querySelector("img[data-src]");
            if (img && !img.src) {
              img.src = img.dataset.src; // load full
              img.removeAttribute("data-src");
              // optionally we can unobserve once loaded
              this._observer.unobserve(card);
            }
          }
        }
      }
    }, options);

    // observe all card elements
    const cards = Array.from(this.renderRoot.querySelectorAll(".card"));
    cards.forEach((c) => this._observer.observe(c));
  }

  // toggle like/dislike; ensures single action per user per photo (toggle)
  handleAction(photoId, action) {
    const idx = this.photos.findIndex((p) => p.id === photoId);
    if (idx === -1) return;
    const current = this.photos[idx];
    const prevStatus = current.status; // 'liked'|'disliked'|null

    // If same action pressed, undo it
    if (prevStatus === action) {
      if (action === "liked") current.likes = Math.max(0, current.likes - 1);
      if (action === "disliked") current.dislikes = Math.max(0, current.dislikes - 1);
      current.status = null;
    } else {
      // remove old effect
      if (prevStatus === "liked") current.likes = Math.max(0, current.likes - 1);
      if (prevStatus === "disliked") current.dislikes = Math.max(0, current.dislikes - 1);

      // apply new
      if (action === "liked") {
        current.likes++;
        current.status = "liked";
      } else if (action === "disliked") {
        current.dislikes++;
        current.status = "disliked";
      } else {
        current.status = null;
      }
    }

    // persist statuses by id map and photo counts
    this._persistStatuses();
    this._persistPhotoCounts();
    this.requestUpdate();
  }

  _persistStatuses() {
    // create an object keyed by id => status
    const statusMap = {};
    (this.photos || []).forEach((p) => {
      if (p.status) statusMap[p.id] = p.status;
    });
    localStorage.setItem("tinder-statuses", JSON.stringify(statusMap));
    this._savedStatuses = statusMap;
  }

  _persistPhotoCounts() {
    // save likes/dislikes alongside id so counts persist across refresh
    localStorage.setItem("tinder-photos", JSON.stringify(this.photos.map(p => ({ id: p.id, likes: p.likes, dislikes: p.dislikes }))));
    this._savedPhotos = JSON.parse(localStorage.getItem("tinder-photos"));
  }

  openInfo(photoId) {
    const p = this.photos.find((x) => x.id === photoId);
    if (!p) return;
    this.modalData = p;
    this.showModal = true;
  }

  closeInfo() {
    this.showModal = false;
    this.modalData = null;
  }

  async handleShare(photo) {
    const shareUrl = photo.full || photo.thumbnail || location.href;
    const title = photo.name || "Tinder Fox";
    // try web share first
    if (navigator.share) {
      try {
        await navigator.share({ title, text: photo.name || "", url: shareUrl });
      } catch (e) {
        // user canceled or error; fallback to clipboard
        console.warn("Share failed, falling back to clipboard", e);
        await this._copyToClipboard(shareUrl);
        alert("Link copied to clipboard.");
      }
    } else {
      // fallback: copy to clipboard
      await this._copyToClipboard(shareUrl);
      // small UI feedback
      const prev = document.activeElement;
      alert("Link copied to clipboard.");
      prev && prev.focus && prev.focus();
    }
  }

  async _copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // fallback older approach
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch (err) {
        console.warn("Copy fallback failed", err);
      }
      document.body.removeChild(ta);
    }
  }

  static get styles() {
    return [
      super.styles,
      css`
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 18px 12px;
          box-sizing: border-box;
          background: var(--tinder-background, #faf9f6);
          color: var(--tinder-text, #222);
          min-height: 100vh;
        }

        h1 {
          font-size: 1.6rem;
          margin: 6px 0 14px;
          display: block;
          text-align: center;
        }

        .controls-row {
          margin-bottom: 12px;
        }

        .gallery {
          display: flex;
          gap: 18px;
          width: 100%;
          overflow-x: auto;
          padding: 8px 6px;
          scroll-snap-type: x mandatory;
        }

        /* Card */
        .card {
          position: relative;
          flex: 0 0 320px;
          height: 420px;
          border-radius: 16px;
          overflow: hidden;
          background: var(--tinder-card-bg, #fff);
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          scroll-snap-align: center;
        }

        .card .img-wrap {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .meta {
          position: absolute;
          bottom: 70px;
          left: 12px;
          background: rgba(0,0,0,0.55);
          color: #fff;
          padding: 8px 10px;
          border-radius: 10px;
          font-size: 0.95rem;
          display: inline-flex;
          gap: 10px;
          align-items: center;
          z-index: 6;
        }

        .buttons {
          position: absolute;
          bottom: 14px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 7;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .btn {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.05rem;
          box-shadow: 0 4px 8px rgba(0,0,0,0.12);
        }

        .btn.info { background: #444; }
        .btn.like { background: #e8505b; } /* red-ish heart */
        .btn.dislike { background: #4b7bd3; } /* blue X */
        .btn.share { background: #6b6b6b; width: 40px; height: 40px; border-radius: 8px; font-size: 0.95rem; }

        /* Liked/disliked card outlines */
        .card.liked { box-shadow: 0 10px 30px rgba(40,167,69,0.12); border: 4px solid rgba(40,167,69,0.18); transform: scale(1.02); }
        .card.disliked { box-shadow: 0 10px 30px rgba(220,53,69,0.08); border: 4px solid rgba(220,53,69,0.12); transform: scale(0.99); }

        /* Modal */
        .modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .modal-card {
          width: 320px;
          max-width: calc(100% - 32px);
          background: var(--tinder-card-bg, #fff);
          color: var(--tinder-text, #222);
          padding: 16px;
          border-radius: 10px;
          box-shadow: 0 8px 20px rgba(0,0,0,0.18);
          text-align: center;
        }

        .modal-card h3 { margin: 0 0 8px; }
        .modal-row { margin: 6px 0; font-size: 0.95rem; }

        .close-btn {
          margin-top: 12px;
          padding: 10px 12px;
          width: 100%;
          border-radius: 8px;
          background: #333;
          color: white;
          border: none;
          cursor: pointer;
        }

        /* Responsive adjustments */
        @media (max-width: 640px) {
          .card { flex: 0 0 80%; height: 380px; }
          .meta { font-size: 0.9rem; padding: 6px 8px; bottom: 68px; }
          .btn { width: 44px; height: 44px; }
        }

        /* Dark theme support */
        @media (prefers-color-scheme: dark) {
          :host { background: #0f1112; color: #e6e6e6; }
          .card { background: #0f1315; }
          .meta { background: rgba(0,0,0,0.6); color: #fff; }
          .modal-card { background: #111315; color: #e6e6e6; }
          .close-btn { background: #eee; color: #111; }
        }
      `,
    ];
  }

  render() {
    if (this.loading) {
      return html`<p>Loading photos…</p>`;
    }

    return html`
      <h1>🦊 Tinder Fox</h1>

      <div class="gallery" role="list">
        ${this.photos.map((photo, idx) => html`
          <div class="card ${photo.status ? photo.status : ''}" data-idx="${idx}" role="listitem">
            <div class="img-wrap" title="${photo.name}">
              <!-- Lazy-load: data-src holds the real image until observed -->
              <img data-src="${photo.full || photo.thumbnail}" alt="${photo.name}" loading="lazy" />
            </div>

            <div class="meta" aria-hidden="true">
              <span>❤️ ${photo.likes}</span>
              <span style="opacity:0.9">|</span>
              <span>❌ ${photo.dislikes}</span>
            </div>

            <div class="buttons" role="group" aria-label="actions">
              <button class="btn info" title="Info" @click="${() => this.openInfo(photo.id)}">ℹ️</button>
              <button class="btn like" title="Like" @click="${() => this.handleAction(photo.id, 'liked')}">❤️</button>
              <button class="btn dislike" title="Dislike" @click="${() => this.handleAction(photo.id, 'disliked')}">❌</button>
              <button class="btn share" title="Share" @click="${() => this.handleShare(photo)}">🔗</button>
            </div>
          </div>
        `)}
      </div>

      <!-- Info Modal -->
      ${this.showModal && this.modalData ? html`
        <div class="modal" @click="${this.closeInfo}">
          <div class="modal-card" @click="${(e) => e.stopPropagation()}">
            <h3>${this.modalData.name}</h3>
            <div class="modal-row"><strong>ID:</strong> ${this.modalData.id}</div>
            <div class="modal-row"><strong>Date:</strong> ${this.modalData.date}</div>
            <div class="modal-row"><strong>Author:</strong> ${this.modalData.author?.name || 'Unknown'}</div>
            <div class="modal-row"><strong>Channel:</strong> ${this.modalData.author?.channel || '—'}</div>
            <div class="modal-row"><strong>Likes:</strong> ${this.modalData.likes} · <strong>Dislikes:</strong> ${this.modalData.dislikes}</div>

            <button class="close-btn" @click="${this.closeInfo}">Close</button>
          </div>
        </div>
      ` : ''}
    `;
  }
}

globalThis.customElements.define(TinderFox.tag, TinderFox);
