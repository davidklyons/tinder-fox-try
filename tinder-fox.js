/**
 * Copyright 2025 davidklyons
 * @license Apache-2.0, see LICENSE for full text.
 */

import { LitElement, html, css } from "lit";
import { DDDSuper } from "@haxtheweb/d-d-d/d-d-d.js";
import { I18NMixin } from "@haxtheweb/i18n-manager/lib/I18NMixin.js";

export class TinderFox extends I18NMixin(DDDSuper(LitElement)) {
  static get properties() {
    return {
      foxes: { type: Array },
      loading: { type: Boolean }
    };
  }

  constructor() {
    super();
    this.foxes = [];
    this.loading = false;

    // Restore previous session from localStorage
    const saved = localStorage.getItem("tinderfox-foxes");
    if (saved) {
      try {
        this.foxes = JSON.parse(saved);
      } catch (e) {
        console.warn("Error loading localStorage data", e);
      }
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
        max-width: 600px;
        margin: 0 auto;
        padding: 16px;
        text-align: center;
        font-family: sans-serif;
      }

      button {
        padding: 10px 16px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 16px;
        margin-bottom: 20px;
      }

      .gallery {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .card {
        padding: 10px;
        border-radius: 12px;
        background: var(--ddd-theme-default-cardBackground, #f3f3f3);
        box-shadow: 0 2px 6px rgba(0,0,0,0.1);
      }

      img {
        width: 100%;
        border-radius: 12px;
      }

      a {
        color: blue;
        font-size: 14px;
        display: block;
        margin-top: 4px;
      }
    `;
  }

  async loadFox() {
    this.loading = true;
    const url = `https://randomfox.ca/floof/`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      // Add new fox to the array
      this.foxes = [
        ...this.foxes,
        {
          id: crypto.randomUUID(), // unique ID
          image: data.image,
          link: data.link
        }
      ];

      // Store in localStorage
      localStorage.setItem("tinderfox-foxes", JSON.stringify(this.foxes));

    } catch (e) {
      console.error("Error fetching fox", e);
    }

    this.loading = false;
  }

  render() {
    return html`
      <button @click="${this.loadFox}">
        ${this.loading ? "Loading..." : "Load Fox"}
      </button>

      <div class="gallery">
        ${this.foxes.map(
          fox => html`
            <div class="card">
              <img src="${fox.image}" alt="Fox image" loading="lazy" />
              <a href="${fox.link}" target="_blank">Source Link</a>
            </div>
          `
        )}
      </div>
    `;
  }
}

customElements.define("tinder-fox", TinderFox);
