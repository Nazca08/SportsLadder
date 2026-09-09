/**
 * Simplified state outlines, one per market.
 *
 * Derived from the US Census cartographic boundary files (public domain) via
 * us-atlas, run through Douglas-Peucker simplification tuned per state: a
 * single global setting either flattens North Carolina into a wedge or deletes
 * Puerto Rico entirely for being small. Each path is normalised into a 100x100
 * box and scaled so each covers a similar AREA rather than a similar bounding
 * box -- otherwise blocky Utah fills its badge while thin Puerto Rico shrinks
 * to an invisible sliver.
 */
export const STATE_PATHS: Record<string, string> = {
  tx: "M31.1,9.8L50.5,9.8L50.5,25.1L68.8,31.6L81.2,29.8L86,32.3L88.8,33L88.8,33L88.9,37.1L88.9,44.9L92.2,51L90.2,62.2L73.4,72.1L67.2,79.6L67.4,90.2L56.2,86L53.8,78.3L41,61.5L33.4,61.9L30.4,67.4L21.4,62.6L18.2,54.8L8.4,46.5L7.8,44.9L30.7,44.9Z",
  nc: "M110.9,37.7L110.9,37.7L110.9,37.7ZM106.9,52.8L106.9,52.8L106.9,52.8ZM26.6,26.2L46.2,27L109,26.9L108.1,32.3L97.5,37.7L109.8,37.3L110.2,43.9L105,48.3L92.5,45.1L100.4,49.5L96.2,55.4L100.9,53L103,55.1L99.4,61.1L92.4,59.9L85,64.1L79.2,73.7L71,73.8L55,57.4L39,57.1L35.6,51.4L17.9,50.6L6.3,54L-10.9,54.2L-10.5,50.1L-3.2,44.2L0.9,44.1L18.9,33.8L21.6,34.3Z",
  ut: "M24.1,16.5L55.2,16.3L55.2,30.3L75.9,30.2L76,83.7L24,83.6Z",
  mn: "M14.1,12.6L33.6,12.6L46.3,19.5L85.9,26.8L76.9,30.9L63.1,44.7L54.9,60L55.6,70.8L70.5,87.4L21.4,87.4L20.3,55.2Z",
  pr: "M132.3,40.9L132.3,40.9L132.3,40.9ZM117.3,56.5L117.3,56.5L117.3,56.5ZM116.2,38L116.2,38L116.2,38ZM9.8,39.7L17.8,30.4L90.9,33.5L113.6,41L115.7,50L100.9,63.2L74.3,69.6L61,64.9L13.5,67.4L17.1,51.2ZM-32.3,56.8L-32.3,56.8L-32.3,56.8Z",
};

/** Which outline a market uses. */
export const AREA_STATE: Record<string, string> = {
  "dallas-tx": "tx",
  "belmont-nc": "nc",
  "provo-ut": "ut",
  "minneapolis-mn": "mn",
  "palmas-del-mar-pr": "pr",
};
