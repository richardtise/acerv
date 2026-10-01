# ACERV — brand sheet

> **acervus**, *n.* — a heap, pile, mass. **coacervāre** — to heap together. **acervātim** — in heaps.
> In rhetoric, an *acervus* is a piled-up mass of evidence.

## 1. Does the name work? Honest scorecard

**What's strong**

- **The meaning is the product.** The platform literally accumulates verified contributions into one heap. This isn't a stretched metaphor; the Latin is exact.
- **Ownable.** Not a dictionary word in English, so no aftermarket premium. Short (5 letters), one hard consonant cluster, holds up in a wordmark.
- **Romance-language bonus.** *Acervo* is a live word in Portuguese and Spanish for a collection or archive — "o acervo do museu", "acervo cultural". A large share of data-labeling contributors are in Brazil and LatAm, and for them the name reads as *the collection*, not as a coined tech word.
- **No baggage.** No incumbent in AI data or crypto holds it in a way that blocks you, and it doesn't smell like a 2017 token.
- **It names the thing, not a feature** — the same quality that made `cairn` feel right. Cairn said "marker"; Acerv says "the accumulated body of work".

**What's risky**

| Risk | Severity | Mitigation |
|---|---|---|
| Pronunciation isn't self-evident (AY-serv vs uh-SERV) | Medium | Pick **"uh-SERV"** (stress follows *acervus*) and use it in the first line of every early intro. Alternatively accept "AY-serv" and never fight it — but choose, and be consistent. |
| `Acer` adjacency — it opens with the name of a global PC brand | Medium | Get a real trademark search in your classes before you spend on it. Distinctness is arguable, but the tech-context confusion is real. Not legal advice. |
| "Acerbic" shadow — *acerbus* means sour/bitter | Low | Minor tonal drag, mostly invisible in use. |
| Not verbable — "acerv it" doesn't work | Low | The action lives in plain English: *add to the heap*. Verbing a Latin noun always sounds forced. |
| Latin coinages read cold/clinical | Low | Always anchor it to a concrete English half: "Acerv — the heap of verified work." Never let the name float alone. |
| A naming agency lists a case study named "Acerv" | Unknown | Worth 5 minutes of checking who else operates under it. |

**Verdict: A−.** Weaker than `cairn` on instant warmth and sayability, and stronger on ownership, cost, and semantic fit. It works if you commit to the stone vocabulary below; it dies if the name has to carry the meaning by itself.

## 2. How to talk about it — the mechanic mapping

The name gives you a complete vocabulary that maps 1:1 onto what the code already does:

| What the product does | Brand word | Where it comes from |
|---|---|---|
| The whole verified dataset | **the acervo / the heap** | *acervus* |
| One accepted submission | **a stone** | you build a heap one stone at a time |
| Points | **weight** | stones are measured by what they weigh |
| Tier ladder | **the climb** | Scout → … → Architect already fits masonry |
| Modality badge | **seam** | a seam is a deposit of ore — your specialty vein |
| Accuracy % | **grade** | ore grade = concentration of the valuable part |
| Verifier bot / review | **weighing** | nothing enters the heap unweighed |
| Vault deposit | **mortar** | what you lay down binds your stones together |
| Streaming vesting | **settling** | stones settle into place over time |
| Appeal | **re-weighing** | you can contest the scale |
| Leaderboard | **the weigh-in** | heaviest heaps this week |

> **Rule: brand words in marketing, plain words in the workflow.** Say "add to the heap" on the landing page, but keep "Submit task" on the button. Nobody should have to learn a lexicon to claim their points.

## 3. Copy

**Positioning line**
> Acerv is a decentralized data marketplace where human work is weighed, verified, and stacked into one permanent, auditable heap.

**Hero headline options**
- Verified human work, heaped.
- Every task you finish becomes a stone in the acervo.
- The heap only grows with proof.

**CTAs** — primary: *Add to the heap* · secondary: *Start gathering*

**Section headers**
- Verification → **Weighed, not guessed**
- Modalities → **Seams, not silos**
- Vault → **Mortar**
- Tiers → **From the first stone to Architect**

**In-product lines**
- Empty state: *The heap starts with one stone.*
- Weekly cap: *The heap grows as fast as you can carry it.*
- Accuracy penalty: *Chipped stones don't stack.*
- Referral: *Bring someone who lays a good stone.*
- Vault CTA: *Set your stones in mortar.*
- Appeal: *Wrongly weighed? Ask for a re-weigh.*
- Leaderboard: *Heaviest heaps this week.*

## 4. Logo

**Construction.** The mark is the letter **A** assembled from **five cut stone slabs** — two per leg, one crossbar. It reads simultaneously as a monogram and as a heap, which is the whole idea: many separate pieces, stacked by hand, holding each other up.

- The **crossbar is the accent colour**. It's the stone wedged between the legs — the piece that makes the A hold. Visually it stands for verification: the layer that turns a pile into a structure.
- **The gaps are load-bearing.** 2.5 units of mortar line separate each stone. Below roughly 24px they close and the mark degrades into a solid, clean A — so the same file works as a favicon without a second asset.
- Slight tonal variation between the four leg stones sells "separate pieces" in colour; the monochrome cut is the same geometry at one weight.
- **Tone names:** *Basalt* (warm, archaeological — default) and *Slate* (cool, instrumented — product UI and dark mode). One accent only: copper `#C9762E` or signal `#3FB6F0`.

**Rules**
- Minimum size 24px for the full-colour mark; use a monochrome cut below that.
- Never rotate, outline, or re-space the stones — the gaps are proportional, not decorative.
- Don't recolor the crossbar independently of the palette; one accent per lockup.
- Clear space = the width of one leg stone on all sides.
- The mark can replace the "A" in "ACERV" when the wordmark must be tight, but never drop the mark entirely from a first impression — the icon is the brand.

**Files**
- `acerv-mark.svg` — primary, Basalt
- `acerv-mark-slate.svg` — cool variant
- `acerv-mark-mono-dark.svg` / `acerv-mark-mono-light.svg` — single-colour cuts
- `acerv-lockup-dark.svg` / `acerv-lockup-light.svg` — horizontal lockups
- `acerv-sheet.png` — the review sheet (all sizes, mono, app icon)
- `build-logo.py` — the generator; retune `SPLIT_Y`, `CB_TOP_Y`, `GAP` or the palettes at the top and re-run to regenerate every asset

The wordmark in these files is set in Noto Sans as a stand-in. Commission or license a real grotesk (Inter, Söhne, Satoshi) before launch — or, for a cheaper distinctive move, commission only the five letters as custom slab-cut forms.
