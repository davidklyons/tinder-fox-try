import { html, fixture, expect } from '@open-wc/testing';
import "../tinder-fox.js";

describe("TinderFox test", () => {
  let element;
  beforeEach(async () => {
    element = await fixture(html`
      <tinder-fox
        title="title"
      ></tinder-fox>
    `);
  });

  it("basic will it blend", async () => {
    expect(element).to.exist;
  });

  it("passes the a11y audit", async () => {
    await expect(element).shadowDom.to.be.accessible();
  });
});
