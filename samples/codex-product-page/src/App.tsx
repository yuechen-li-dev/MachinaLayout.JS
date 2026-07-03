import { useEffect, useMemo, useState } from "react";
import type { Rect } from "machinalayout";
import { MachinaReactView, type MachinaSlotProps } from "machinalayout/react";
import { PRODUCT_LAYERS, productText, resolveProductLayout } from "./productLayout";

const MIN_WIDTH = 390;
const MIN_HEIGHT = 720;

function getRootRect(): Rect {
  if (typeof window === "undefined") {
    return { x: 0, y: 0, width: 1440, height: 900 };
  }

  return {
    x: 0,
    y: 0,
    width: Math.max(MIN_WIDTH, window.innerWidth),
    height: Math.max(MIN_HEIGHT, window.innerHeight),
  };
}

function useRootRect(): Rect {
  const [rect, setRect] = useState(getRootRect);

  useEffect(() => {
    const update = () => setRect(getRootRect());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return rect;
}

function Page() {
  return <main className="page-surface" />;
}

function Wordmark() {
  return (
    <header className="wordmark">
      <a href="/" aria-label="CODEX home">
        CODEX
      </a>
    </header>
  );
}

function SideNav() {
  return (
    <nav className="side-nav" aria-label="Product navigation">
      <div className="nav-section nav-section-primary">
        <a href="/">New</a>
        <a href="/">Gifts</a>
        <a href="/">Shows</a>
      </div>
      <div className="nav-section">
        <strong>Women</strong>
        <a href="/">Handbags</a>
        <a href="/">Mini bags</a>
        <a href="/">Shoes</a>
        <a href="/">Ready to wear</a>
      </div>
      <div className="nav-section">
        <a href="/">View all</a>
        <a href="/">Slingbacks</a>
        <a href="/">Pumps</a>
        <a href="/">Boots</a>
      </div>
      <div className="nav-section nav-section-secondary">
        <a href="/">Store locator</a>
        <a href="/">Sign in / register</a>
        <a href="/">Search</a>
      </div>
    </nav>
  );
}

function ProductMedia() {
  return (
    <section className="product-media" aria-label="Product image placeholder">
      <svg className="product-silhouette" viewBox="0 0 720 360" aria-hidden="true">
        <title>Stylized black slingback pump</title>
        <defs>
          <linearGradient id="patent" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#2a2a2a" />
            <stop offset="42%" stopColor="#030303" />
            <stop offset="100%" stopColor="#151515" />
          </linearGradient>
          <linearGradient id="highlight" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.52" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <filter id="softShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow
              dx="0"
              dy="12"
              stdDeviation="10"
              floodColor="#000000"
              floodOpacity="0.18"
            />
          </filter>
        </defs>
        <g filter="url(#softShadow)">
          <path
            className="shoe-strap-svg"
            d="M310 144 C273 96 252 62 230 28"
            fill="none"
            stroke="#050505"
            strokeLinecap="round"
            strokeWidth="15"
          />
          <path
            className="shoe-strap-edge"
            d="M317 140 C282 95 263 63 242 31"
            fill="none"
            stroke="#2d2d2d"
            strokeLinecap="round"
            strokeWidth="3"
          />
          <path
            className="shoe-heel-svg"
            d="M154 153 C176 160 184 178 180 207 L163 302 C160 315 141 315 141 301 L146 190 C147 171 148 160 154 153 Z"
            fill="#070707"
          />
          <path
            className="shoe-quarter-svg"
            d="M151 152 C206 151 244 169 282 204 C238 199 193 190 146 175 C141 166 144 157 151 152 Z"
            fill="url(#patent)"
          />
          <path
            className="shoe-upper-svg"
            d="M248 207 C315 226 407 235 613 238 C648 239 674 250 690 267 C579 281 438 285 279 272 C229 268 195 250 169 214 C193 209 221 205 248 207 Z"
            fill="url(#patent)"
          />
          <path
            className="shoe-vamp-cut"
            d="M290 210 C352 221 430 226 530 227 C448 240 356 242 278 229 C259 226 254 217 290 210 Z"
            fill="#eeeeee"
          />
          <path
            className="shoe-toe-svg"
            d="M541 229 C627 231 675 244 696 268 C651 266 600 263 545 258 Z"
            fill="#020202"
          />
          <path
            className="shoe-sole-svg"
            d="M159 273 C292 292 510 295 691 272"
            fill="none"
            stroke="#0a0a0a"
            strokeLinecap="round"
            strokeWidth="9"
          />
          <path
            className="shoe-highlight-svg"
            d="M331 222 C399 230 484 233 584 233"
            fill="none"
            stroke="url(#highlight)"
            strokeLinecap="round"
            strokeWidth="10"
          />
          <circle cx="222" cy="26" r="11" fill="#d5b25f" />
          <circle cx="222" cy="26" r="5" fill="#f5df91" />
        </g>
      </svg>
    </section>
  );
}

function ProductSummary() {
  return (
    <section className="product-summary">
      <p className="product-title">{productText.title.source.text}</p>
      <p className="product-price">{productText.price.source.text}</p>
      <p className="color-name">Black</p>
      <fieldset className="swatches">
        <legend className="sr-only">Color</legend>
        <button className="swatch swatch-oxblood" aria-label="Oxblood" />
        <button className="swatch swatch-black is-selected" aria-label="Black" />
      </fieldset>
    </section>
  );
}

function FitNote() {
  return <p className="fit-note">This model is true to size, please order your usual size.</p>;
}

function SizeButton({ label, disabled }: { label: string; disabled?: boolean }) {
  return (
    <button className="size-button" disabled={disabled}>
      {label}
    </button>
  );
}

function SizeGuide() {
  return (
    <button className="text-link" type="button">
      Size guide <span aria-hidden="true">›</span>
    </button>
  );
}

function ApplePayButton() {
  return (
    <button className="pay-button" type="button">
      Apple Pay
    </button>
  );
}

function AddToBagButton() {
  return (
    <button className="bag-button" type="button">
      Add to Bag
    </button>
  );
}

function PurchaseCopy() {
  return (
    <section className="purchase-copy">
      <p>I accept the general conditions of sale and the privacy policy.</p>
      <p>Estimated delivery date starting from Tuesday July 7.</p>
    </section>
  );
}

function DetailRows() {
  return <section className="detail-group" aria-label="Product details" />;
}

function DetailRow({ label }: { label: string }) {
  return (
    <button className="detail-row" type="button">
      <span>{label}</span>
      <span aria-hidden="true">+</span>
    </button>
  );
}

const VIEWS = {
  Page,
  Wordmark,
  SideNav,
  ProductMedia,
  PurchasePanel: () => <aside className="purchase-panel" />,
  ProductSummary,
  FitNote,
  Size34: () => <SizeButton label="34" disabled />,
  Size35: () => <SizeButton label="35" />,
  Size36: () => <SizeButton label="36" disabled />,
  Size37: () => <SizeButton label="37" />,
  Size38: () => <SizeButton label="38" />,
  Size39: () => <SizeButton label="39" />,
  Size40: () => <SizeButton label="40" disabled />,
  Size41: () => <SizeButton label="41" />,
  Size42: () => <SizeButton label="42" />,
  Size43: () => <SizeButton label="43" disabled />,
  SizeGuide,
  ApplePayButton,
  AddToBagButton,
  PurchaseCopy,
  DetailRows,
  DetailsRow: () => <DetailRow label="Details" />,
  CareRow: () => <DetailRow label="Care and maintenance" />,
  ShippingRow: () => <DetailRow label="Shipping" />,
  ReturnsRow: () => <DetailRow label="Returns and exchanges" />,
} satisfies Record<string, React.ComponentType<MachinaSlotProps>>;

export function App() {
  const rootRect = useRootRect();
  const layout = useMemo(() => resolveProductLayout(rootRect), [rootRect]);

  return (
    <MachinaReactView
      layout={layout}
      views={VIEWS}
      layers={PRODUCT_LAYERS}
      className="codex-product-page"
      nodeClassName="machina-node"
      nodeContainment="layout-paint"
      nodeContentVisibility="none"
    />
  );
}
