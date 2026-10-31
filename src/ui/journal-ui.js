// The Archivist's journal, drawn at the end of the Archive section: what has been seen in the valley, and sealed lines for the rest.
import * as Journal from "../shared/journal.js";
import { esc } from "./cards.js";
const KIND = { folklore: "Folklore", invented: "Invented for this valley" };
const when = t => { try { return new Date(t).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } };

export function initJournal(root) {
  if (!root) return;
  const render = () => {
    const p = Journal.progress();
    root.innerHTML = `<header class="jn-head"><h3>The Archivist’s Journal</h3><span class="jn-count"><b>${p.seen}</b> / ${p.total} sightings</span></header>
      <p class="jn-sub">Rare things are sometimes seen in the valley below the castle. When one is, the Archivist writes it down here. Sightings are luck, not progress: they do not count as cards.</p>
      <ol class="jn-list">${Journal.ENTRIES.map(e => { const s = Journal.seen(e.id); return s.first
        ? `<li class="jn-e on" data-entry="${esc(e.id)}"><span class="jn-k k-${e.kind}">${KIND[e.kind]}</span><h4>${esc(e.title)}</h4><p>${esc(e.text)}</p><small>First seen ${esc(when(s.first))}${s.n > 1 ? ` · seen ${s.n} times` : ""}</small></li>`
        : `<li class="jn-e" data-entry="${esc(e.id)}"><span class="jn-k">Not yet seen</span><h4 aria-label="Unknown sighting">· · ·</h4><p class="jn-hint">${esc(e.hint)}</p></li>`; }).join("")}</ol>`;
  };
  render(); Journal.onChange(render);
}
