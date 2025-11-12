/**
 * Copyright 2025 davidklyons
 * @license Apache-2.0, see LICENSE for full text.
 */
import { LitElement, html, css } from "lit";
import { DDDSuper } from "@haxtheweb/d-d-d/d-d-d.js";
import { I18NMixin } from "@haxtheweb/i18n-manager/lib/I18NMixin.js";

/**
 * `tinder-fox`
 * A mini game for swiping (liking/disliking) fox photos.
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
      liked: { type: Array },
      disliked: { type: Array },
      loading: { type: Boolean },
      showInfo: { type: Boolean },
      selectedPhoto: { type: Object },
    };
  }

  constructor() {
    super();
    this.photos = [];
    this.liked = JSON.parse(localStorage.getItem("likedPhotos") || "[]");
    this.disliked = JSON.parse(localStorage.getItem("dislikedPhotos") || "[]");
    this.loading = true;
    this.showInfo = false;
    this.selectedPhoto = null;
  }

  firstUpdated() {
    fetch("./data/photos.json")
      .then((res) => res.json())
      .then((data) => {
        // Support both array or { photos: [...] } structure
        const photosArray = Array.isArray(data) ? data : data.photos || [];
        this.photos = photosArray.map((p) => ({
          ...p,
          likes: p.likes || Math.floor(Math.random() * 300) + 50,
          dislikes: p.dislikes || Math.floor(Math.random() * 100),
          status: this.liked.includes(p.id)
            ? "liked"
            : this.disliked.includes(p.id)
            ? "disliked"
            : null,
        }));
        this.loading = false;
      })
      .catch((err) => console.error("Error loading photos:", err));
  }

  handleAction(photo, action) {
    const index = this.photos.findIndex((p) => p.id === photo.id);
    if (index === -1) return;
    const current = this.photos[index];
    const wasLiked = current.status === "liked";
    const wasDisliked = current.status === "disliked";

    // Undo if clicking same button again
    if ((action === "liked" && wasLiked) || (action === "disliked" && wasDisliked)) {
      if (action === "liked") {
        current.likes--;
        this.liked = this.liked.filter((id) => id !== current.id);
      } else {
        current.dislikes--;
        this.disliked = this.disliked.filter((id) => id !== current.id);
      }
      current.status = null;
    } else {
      // Reset opposite state
      if (wasLiked) {
        current.likes--;
        this.liked = this.liked.filter((id) => id !== current.id);
      }
      if (wasDisliked) {
        current.dislikes--;
        this.disliked = this.disliked.filter((id) => id !== current.id);
      }

      // Apply new action
      if (action === "liked") {
        current.likes++;
        current.status = "liked";
        this.liked.push(current.id);
      } else if (action === "disliked") {
        current.dislikes++;
        current.status = "disliked";
        this.disliked.push(current.id);
      }
    }

    // Save
    localStorage.setItem("likedPhotos", JSON.stringify(this.liked));
    localStorage.setItem("dislikedPhotos", JSON.stringify(this.disliked));

    this.requestUpdate();
  }

  openInfo(photo) {
    this.selectedPhoto = photo;
    this.showInfo = true;
  }

  closeInfo() {
    this.showInfo = false;
    this.selectedPhoto = null;
  }

  static get styles() {
    return [
      super.styles,
      css`
        :host {
          display: flex;
          flex-direction: column;
          align-items: center;
          background: var(--ddd-theme-background, #fafafa);
          color: var(--ddd-theme-primary, #222);
          font-family: var(--ddd-font-navigation);
        }

        .gallery {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          gap: 20px;
          width: 90%;
          padding: 10px 0;
        }

        .card {
          position: relative;
          flex: 0 0 auto;
          width: 320px;
          height: 400px;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.25);
          scroll-snap-align: center;
          transition: border 0.3s ease, transform 0.3s ease;
          background-color: #fff;
          border: 5px solid transparent;
        }

        .card.liked {
          border-color: #28a745;
          transform: scale(1.02);
        }

        .card.disliked {
          border-color: #dc3545;
          transform: scale(0.98);
        }

        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .meta {
          position: absolute;
          bottom: 10px;
          left: 12px;
          color: white;
          background: rgba(0, 0, 0, 0.5);
          padding: 5px 10px;
          border-radius: 10px;
          font-size: 0.9rem;
        }

        .buttons {
          position: absolute;
          bottom: 10px;
          right: 10px;
          display: flex;
          gap: 8px;
        }

        button {
          border: none;
          border-radius: 50%;
          width: 42px;
          height: 42px;
          font-size: 1.1rem;
          cursor: pointer;
          transition: transform 0.2s;
          color: white;
        }

        button:hover {
          transform: scale(1.1);
        }

        .like {
          background: #28a745;
        }

        .dislike {
          background: #dc3545;
        }

        .info-btn {
          background: #333;
        }

        /* Info modal */
        .modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999;
        }

        .modal-content {
          background: #fff;
          padding: 20px;
          border-radius: 12px;
          max-width: 400px;
          text-align: center;
        }

        .modal-content img {
          width: 100%;
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .close-btn {
          background: #333;
          margin-top: 10px;
          color: #fff;
        }
      `,
    ];
  }

  render() {
    if (this.loading) {
      return html`<p>🦊 Loading photos...</p>`;
    }

    return html`
      <div class="gallery">
        ${this.photos.map(
          (photo) => html`
            <div class="card ${photo.status || ""}">
              <img src="${photo.full || photo.thumbnail}" alt="${photo.name}" />
              <div class="meta">
                ❤️ ${photo.likes} | ❌ ${photo.dislikes}
              </div>
              <div class="buttons">
                <button
                  class="like"
                  @click="${() => this.handleAction(photo, "liked")}"
                  title="Like"
                >
                  ❤️
                </button>
                <button
                  class="dislike"
                  @click="${() => this.handleAction(photo, "disliked")}"
                  title="Dislike"
                >
                  ❌
                </button>
                <button
                  class="info-btn"
                  @click="${() => this.openInfo(photo)}"
                  title="Info"
                >
                  ℹ️
                </button>
              </div>
            </div>
          `
        )}
      </div>

      ${this.showInfo && this.selectedPhoto
        ? html`
            <div class="modal" @click="${this.closeInfo}">
              <div class="modal-content" @click="${(e) => e.stopPropagation()}">
                <img
                  src="${this.selectedPhoto.full || this.selectedPhoto.thumbnail}"
                  alt="${this.selectedPhoto.name}"
                />
                <h3>${this.selectedPhoto.name || "Unknown Fox"}</h3>
                <p>❤️ ${this.selectedPhoto.likes} ❌ ${this.selectedPhoto.dislikes}</p>
                <button class="close-btn" @click="${this.closeInfo}">Close</button>
              </div>
            </div>
          `
        : ""}
    `;
  }
}

globalThis.customElements.define(TinderFox.tag, TinderFox);