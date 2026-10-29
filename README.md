# River Hold'em

No-limit Texas Hold'em in the browser. Runs entirely on GitHub Pages with no server or build step. Made by [4FDR Studios](https://4fdr.dev). Play chips only: no real money is ever wagered or paid out.

## Features

- **Full table rules enforced:** moving button and blinds (with correct heads-up rules), a short big blind still sets the full amount to call, burn cards, minimum bets and raises, short all-in raises that do not reopen betting, no betting once everyone else is all in, uncalled bets returned, main and side pots, split pots with the odd chip to the first winner left of the button, and the proper showdown order where losing hands may be mucked.
- **Coach:** on your turn it shows your hand, your chance to win (by simulating thousands of deals), the pot odds you need, your outs and draws, and the move it would make with reasons. The suggested button is highlighted.
- **Points:** chips are your points. The Points tab ranks everyone by chips, with change since the start, hands won, how often each player plays, and biggest pot. Your record against the computer is saved on your device.
- **vs Computer:** 1 to 5 opponents with their own styles, at four skill levels (Easy, Normal, Hard, Expert).
- **Pass & Play:** 2 to 6 players on one device, plus optional computer players. A privacy screen hides cards until the right player taps to see them.
- **Play Online:** host a table for up to 6 and share the link or code. Empty seats can be filled with computer players. The host's browser runs the game and each player only receives their own cards. Includes chat, a shot clock, and reconnecting to your seat.
- **Extras:** rising blind levels, a shot clock, hand history (viewable and downloadable), five felt colours, four card backs, a four-colour deck option, light/dark mode, sounds, fast play, resume an unfinished game, and installable as an offline app.

## Put it on GitHub Pages

1. Create a repository, for example `poker`, and upload every file to its root (there are no folders).
2. **Settings > Pages**: Deploy from a branch, `main`, `/ (root)`.
3. The `CNAME` file points it at `poker.4fdr.dev`. In Cloudflare add a CNAME record for `poker` pointing to `<your-username>.github.io`.

## Files

```
index.html            page layout
style.css             styling, table and themes
rules.js              rules engine: dealing, betting rules, pots, showdown, hand evaluation
brain.js              computer players and the coach (odds, draws, outs, advice)
art.js                original SVG cards, card backs, chips and icons
app.js                interface, game flow, pass and play, online tables, history and stats
sw.js                 offline cache
manifest.webmanifest  install-as-app metadata
icon.svg              site icon
CNAME                 custom domain
.nojekyll             serve files as-is
```

## Keyboard shortcuts

F fold, C check or call, R bet or raise, H ask the coach.

The rules engine was stress-tested on thousands of random hands with 2 to 6 players, checking that chips are never created or lost and every action follows the rules.
