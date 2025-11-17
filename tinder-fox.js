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
      showModal: { type: Boolean },
      modalData: { type: Object },
      currentIndex: { type: Number },
    };
  }

  constructor() {
    super();
    this.photos = [];
    this.loading = true;
    this.showModal = false;
    this.modalData = null;
    this.currentIndex = 0;
    this._observer = null;

    this._savedStatuses = JSON.parse(localStorage.getItem("tinder-statuses") || "null");
    this._savedPhotos = JSON.parse(localStorage.getItem("tinder-photos") || "null");

    this._onScroll = this._onScroll.bind(this);
    this._handleKeyboard = this._handleKeyboard.bind(this);
    this._handleResize = this._handleResize.bind(this);
  }

  async firstUpdated() {
    try {
      const res = await fetch("./data/photos.json");
      const data = await res.json();

      this.photos = (data.photos || []).map((p) => {
        const copy = {
          id: p.id,
          name: p.name,
          date: p.date,
          thumbnail: p.thumbnail,
          full: p.full,
          author: p.author || {},
          likes: (this._savedPhotos && this._savedPhotos.find(s => s.id === p.id)?.likes) ?? (p.likes ?? Math.floor(Math.random() * 300) + 50),
          dislikes: (this._savedPhotos && this._savedPhotos.find(s => s.id === p.id)?.dislikes) ?? (p.dislikes ?? Math.floor(Math.random() * 60)),
          status: (this._savedStatuses && this._savedStatuses[p.id]) ? this._savedStatuses[p.id] : null,
          loaded: false,
        };
        return copy;
      });

      this.loading = false;

      this.updateComplete.then(() => {
        this._setupObserver();
        this._setupWheelEffect();
        // Add spacer elements to ensure first/last cards can center
        this._addSpacers();
        // Scroll to first card after initial render
        setTimeout(() => {
          const firstCard = this.renderRoot.querySelector('.card[data-idx="0"]');
          if (firstCard) {
            firstCard.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'center' });
          }
          this._updateScaleEffect();
        }, 100);
        document.addEventListener('keydown', this._handleKeyboard);
      });
    } catch (e) {
      console.error("Error loading photos.json:", e);
      this.loading = false;
    }
  }

  _addSpacers() {
    const gallery = this.renderRoot.querySelector('.gallery');
    if (!gallery) return;

    // Calculate the width needed to center the first and last card
    const galleryWidth = gallery.offsetWidth;
    const spacerWidth = (galleryWidth / 2) - (170); // Half gallery minus half card width

    // Check if spacers already exist
    if (!gallery.querySelector('.spacer-start')) {
      const spacerStart = document.createElement('div');
      spacerStart.className = 'spacer-start';
      spacerStart.style.cssText = `flex: 0 0 ${spacerWidth}px; height: 1px;`;
      gallery.insertBefore(spacerStart, gallery.firstChild);
    }

    if (!gallery.querySelector('.spacer-end')) {
      const spacerEnd = document.createElement('div');
      spacerEnd.className = 'spacer-end';
      spacerEnd.style.cssText = `flex: 0 0 ${spacerWidth}px; height: 1px;`;
      gallery.appendChild(spacerEnd);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._observer) this._observer.disconnect();
    document.removeEventListener('keydown', this._handleKeyboard);
    const gallery = this.renderRoot.querySelector(".gallery");
    if (gallery) gallery.removeEventListener("scroll", this._onScroll);
    window.removeEventListener('resize', this._handleResize);
  }

  // IntersectionObserver for lazy loading
  _setupObserver() {
    if (this._observer) this._observer.disconnect();

    const options = {
      root: this.renderRoot.querySelector(".gallery"),
      rootMargin: "50px", // Very tight margin - only load when almost visible
      threshold: 0.01,
    };

    this._observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = Number(entry.target.getAttribute("data-idx"));
          const photo = this.photos[idx];
          if (photo && !photo.loaded) {
            const img = entry.target.querySelector("img");
            if (img && img.dataset.src) {
              console.log(`🔄 Loading image ${idx}: ${photo.name}`); // Debug logging
              
              // Show spinner immediately
              this.requestUpdate();
              
              // Add artificial delay to make loading VERY obvious
              setTimeout(() => {
                img.src = img.dataset.src;
                img.onload = () => {
                  // Add delay to show the loaded state
                  setTimeout(() => {
                    photo.loaded = true;
                    console.log(`✅ Image ${idx} loaded: ${photo.name}`); // Debug logging
                    this.requestUpdate();
                  }, 400);
                };
                img.onerror = () => {
                  console.error(`❌ Failed to load image ${idx}`);
                  photo.loaded = true; // Mark as loaded to remove spinner
                  this.requestUpdate();
                };
              }, 800 + Math.random() * 700); // Random delay between 800-1500ms (longer!)
            }
          }
        }
      });
    }, options);

    const cards = Array.from(this.renderRoot.querySelectorAll(".card"));
    cards.forEach((c) => this._observer.observe(c));
  }

  // Scroll-based focus scaling like a "wheel"
  _setupWheelEffect() {
    const gallery = this.renderRoot.querySelector(".gallery");
    if (!gallery) return;
    gallery.addEventListener("scroll", this._onScroll);
    window.addEventListener('resize', this._handleResize);
  }

  _handleResize() {
    // Recalculate spacers on window resize
    this._addSpacers();
  }

  _onScroll() {
    this._updateScaleEffect();
  }

  _updateScaleEffect() {
    const gallery = this.renderRoot.querySelector(".gallery");
    if (!gallery) return;

    const galleryRect = gallery.getBoundingClientRect();
    const centerX = galleryRect.left + galleryRect.width / 2;
    let closestIndex = 0;
    let closestDistance = Infinity;

    this.photos.forEach((photo, idx) => {
      const card = this.renderRoot.querySelector(`.card[data-idx="${idx}"]`);
      if (!card) return;
      
      const cardRect = card.getBoundingClientRect();
      const cardCenter = cardRect.left + cardRect.width / 2;
      const distance = Math.abs(centerX - cardCenter);

      // Track closest card to center
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = idx;
      }

      // Calculate scale based on distance from center
      const maxDistance = galleryRect.width / 2;
      const normalizedDistance = Math.min(distance / maxDistance, 1);
      
      // Much more dramatic scaling: 1.0 (center) to 0.5 (edges)
      const scale = 1 - (normalizedDistance * 0.5);
      
      // More dramatic opacity fade: fully visible at center, very faded at edges
      const opacity = 0.3 + (scale * 0.7);
      
      // Apply transform
      card.style.transform = `scale(${scale})`;
      card.style.opacity = `${opacity}`;
      
      // Add a class to the centered card for additional styling
      if (idx === closestIndex) {
        card.classList.add('centered');
      } else {
        card.classList.remove('centered');
      }
    });

    this.currentIndex = closestIndex;
  }

  _handleKeyboard(e) {
    if (this.showModal) return; // Don't navigate when modal is open
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      this.scrollToPrevious();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      this.scrollToNext();
    }
  }

  scrollToNext() {
    const gallery = this.renderRoot.querySelector(".gallery");
    if (!gallery) return;
    
    const nextIndex = Math.min(this.currentIndex + 1, this.photos.length - 1);
    const card = this.renderRoot.querySelector(`.card[data-idx="${nextIndex}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  scrollToPrevious() {
    const gallery = this.renderRoot.querySelector(".gallery");
    if (!gallery) return;
    
    const prevIndex = Math.max(this.currentIndex - 1, 0);
    const card = this.renderRoot.querySelector(`.card[data-idx="${prevIndex}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  handleAction(photoId, action) {
    const idx = this.photos.findIndex((p) => p.id === photoId);
    if (idx === -1) return;
    const current = this.photos[idx];
    const prevStatus = current.status;

    if (prevStatus === action) {
      if (action === "liked") current.likes = Math.max(0, current.likes - 1);
      if (action === "disliked") current.dislikes = Math.max(0, current.dislikes - 1);
      current.status = null;
    } else {
      if (prevStatus === "liked") current.likes = Math.max(0, current.likes - 1);
      if (prevStatus === "disliked") current.dislikes = Math.max(0, current.dislikes - 1);

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

    this._persistStatuses();
    this._persistPhotoCounts();
    this.requestUpdate();
  }

  _persistStatuses() {
    const statusMap = {};
    this.photos.forEach((p) => { if (p.status) statusMap[p.id] = p.status; });
    localStorage.setItem("tinder-statuses", JSON.stringify(statusMap));
    this._savedStatuses = statusMap;
  }

  _persistPhotoCounts() {
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
    if (navigator.share) {
      try { await navigator.share({ title, text: photo.name || "", url: shareUrl }); }
      catch (e) { await this._copyToClipboard(shareUrl); alert("Link copied to clipboard."); }
    } else {
      await this._copyToClipboard(shareUrl);
      alert("Link copied to clipboard.");
    }
  }

  async _copyToClipboard(text) {
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch {}
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
          width: 100%;
        }

        .controls {
          display: flex;
          gap: 16px;
          margin-bottom: 20px;
          align-items: center;
        }

        .nav-btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: none;
          background: var(--tinder-card-bg, #fff);
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.5rem;
          transition: all 0.2s ease;
        }

        .nav-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 16px rgba(0,0,0,0.15);
        }

        .nav-btn:active {
          transform: scale(0.95);
        }

        .gallery-container {
          width: 100%;
          position: relative;
          overflow: hidden;
        }

        .gallery {
          display: flex;
          gap: 40px;
          width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 40px 0; /* Remove padding, spacers will handle it */
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          -webkit-overflow-scrolling: touch;
        }

        .spacer-start,
        .spacer-end {
          flex-shrink: 0;
        }

        .gallery::-webkit-scrollbar {
          height: 12px;
        }

        .gallery::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
          border-radius: 6px;
        }

        .gallery::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.3);
          border-radius: 6px;
        }

        .gallery::-webkit-scrollbar-thumb:hover {
          background: rgba(0,0,0,0.4);
        }

        .card {
          position: relative;
          flex: 0 0 340px;
          height: 480px;
          border-radius: 20px;
          overflow: hidden;
          background: var(--tinder-card-bg, #fff);
          box-shadow: 0 12px 40px rgba(0,0,0,0.15);
          scroll-snap-align: center;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      opacity 0.3s ease,
                      box-shadow 0.3s ease;
          transform-origin: center center;
          pointer-events: auto;
        }

        .card.centered {
          box-shadow: 0 20px 60px rgba(0,0,0,0.25);
          z-index: 10;
        }

        .img-wrap {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .spinner {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          background: linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(250,250,250,0.98) 100%);
          z-index: 5;
          gap: 16px;
          backdrop-filter: blur(2px);
        }

        .spinner div {
          border: 6px solid #f3f3f3;
          border-top: 6px solid #e8505b;
          border-right: 6px solid #ff6b7a;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          animation: spin 0.8s linear infinite;
        }

        .spinner span {
          font-size: 1rem;
          color: #e8505b;
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        @keyframes spin { 
          0% { transform: rotate(0deg); } 
          100% { transform: rotate(360deg); } 
        }

        .card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .meta {
          position: absolute;
          bottom: 80px;
          left: 16px;
          background: rgba(0,0,0,0.65);
          color: #fff;
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 1rem;
          display: inline-flex;
          gap: 12px;
          align-items: center;
          z-index: 6;
          backdrop-filter: blur(8px);
        }

        .buttons {
          position: absolute;
          bottom: 18px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 7;
          display: flex;
          gap: 14px;
          align-items: center;
        }

        .btn {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 1.2rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          transition: all 0.2s ease;
        }

        .btn:hover {
          transform: scale(1.1);
        }

        .btn:active {
          transform: scale(0.95);
        }

        .btn.info { background: #444; }
        .btn.like { background: #e8505b; }
        .btn.dislike { background: #28a745; }
        .btn.share { 
          background: #6b6b6b; 
          width: 44px; 
          height: 44px; 
          border-radius: 10px; 
          font-size: 1rem; 
        }

        .card.liked { 
          box-shadow: 0 12px 40px rgba(232,80,91,0.4); 
          border: 4px solid rgba(232,80,91,0.5); 
        }
        
        .card.disliked { 
          box-shadow: 0 12px 40px rgba(40,167,69,0.35); 
          border: 4px solid rgba(40,167,69,0.5); 
        }

        .modal { 
          position: fixed; 
          inset: 0; 
          background: rgba(0,0,0,0.6); 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          z-index: 9999;
          backdrop-filter: blur(4px);
        }
        
        .modal-card { 
          width: 380px; 
          max-width: calc(100% - 32px); 
          background: var(--tinder-card-bg, #fff); 
          color: var(--tinder-text, #222); 
          padding: 24px; 
          border-radius: 16px; 
          box-shadow: 0 12px 40px rgba(0,0,0,0.25); 
          text-align: center; 
        }
        
        .modal-card h3 { 
          margin: 0 0 16px; 
          font-size: 1.5rem;
        }
        
        .modal-row { 
          margin: 10px 0; 
          font-size: 1rem; 
          text-align: left;
          padding: 8px 0;
          border-bottom: 1px solid rgba(0,0,0,0.1);
        }

        .modal-row:last-of-type {
          border-bottom: none;
        }
        
        .close-btn { 
          margin-top: 20px; 
          padding: 12px 16px; 
          width: 100%; 
          border-radius: 10px; 
          background: #333; 
          color: white; 
          border: none; 
          cursor: pointer;
          font-size: 1rem;
          font-weight: 600;
          transition: all 0.2s ease;
        }

        .close-btn:hover {
          background: #444;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }

        /* Mobile responsive */
        @media (max-width: 768px) {
          .gallery {
            gap: 30px;
          }

          .card {
            flex: 0 0 300px;
            height: 420px;
          }

          .nav-btn {
            width: 44px;
            height: 44px;
            font-size: 1.3rem;
          }

          .btn {
            width: 44px;
            height: 44px;
            font-size: 1.1rem;
          }

          .btn.share {
            width: 38px;
            height: 38px;
          }
        }

        @media (max-width: 480px) {
          .card {
            flex: 0 0 280px;
            height: 400px;
          }
        }

        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          :host { 
            background: #0f1112; 
            color: #e6e6e6; 
          }
          
          .card { 
            background: #1a1d1f; 
          }
          
          .meta { 
            background: rgba(0,0,0,0.75); 
            color: #fff; 
          }

          .nav-btn {
            background: #1a1d1f;
            color: #e6e6e6;
          }

          .spinner {
            background: linear-gradient(135deg, rgba(26,29,31,0.95) 0%, rgba(20,23,25,0.98) 100%);
          }

          .spinner span {
            color: #ff6b7a;
          }
          
          .modal-card { 
            background: #1a1d1f; 
            color: #e6e6e6; 
          }

          .modal-row {
            border-bottom: 1px solid rgba(255,255,255,0.1);
          }
          
          .close-btn { 
            background: #e6e6e6; 
            color: #111; 
          }

          .close-btn:hover {
            background: #fff;
          }

          .gallery::-webkit-scrollbar-track {
            background: rgba(255,255,255,0.05);
          }

          .gallery::-webkit-scrollbar-thumb {
            background: rgba(255,255,255,0.3);
          }

          .gallery::-webkit-scrollbar-thumb:hover {
            background: rgba(255,255,255,0.4);
          }
        }
      `,
    ];
  }

  render() {
    if (this.loading) return html`<p style="font-size: 1.2rem;">Loading photos…</p>`;

    return html`
      <div class="controls">
        <button class="nav-btn" @click="${this.scrollToPrevious}" title="Previous (←)">←</button>
        <span style="font-size: 1rem; color: var(--tinder-text, #222);">
          ${this.currentIndex + 1} / ${this.photos.length}
        </span>
        <button class="nav-btn" @click="${this.scrollToNext}" title="Next (→)">→</button>
      </div>

      <div class="gallery-container">
        <div class="gallery" role="list">
          ${this.photos.map((photo, idx) => html`
            <div class="card ${photo.status ? photo.status : ''}" data-idx="${idx}" role="listitem">
              <div class="img-wrap" title="${photo.name}">
                <img data-src="${photo.full || photo.thumbnail}" alt="${photo.name}" />
                ${!photo.loaded ? html`
                  <div class="spinner">
                    <div></div>
                    <span>Loading...</span>
                  </div>
                ` : ''}
              </div>

              <div class="meta" aria-label="Photo statistics">
                <span>❤️ ${photo.likes}</span>
                <span style="opacity:0.9">|</span>
                <span>❌ ${photo.dislikes}</span>
              </div>

              <div class="buttons" role="group" aria-label="Photo actions">
                <button class="btn info" title="Info" @click="${() => this.openInfo(photo.id)}">ℹ️</button>
                <button class="btn like" title="Like" @click="${() => this.handleAction(photo.id, 'liked')}">❤️</button>
                <button class="btn dislike" title="Dislike" @click="${() => this.handleAction(photo.id, 'disliked')}">❌</button>
                <button class="btn share" title="Share" @click="${() => this.handleShare(photo)}">🔗</button>
              </div>
            </div>
          `)}
        </div>
      </div>

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