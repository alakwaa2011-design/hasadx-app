export type QuranMutashabihatCategory =
  | "lafzi"
  | "word_swap"
  | "addition_omission"
  | "ending_variation"
  | "order_change"
  | "pronoun_shift"
  | "structural";

export interface QuranMutashabihatRelation {
  otherVerseKey: string;
  category: QuranMutashabihatCategory;
}

// Curated references and category labels only; source notes and unreviewed
// records are deliberately not included.
const PAIR_DATA = `
2:2|27:2|word_swap
2:2|31:3|word_swap
2:4|31:4|addition_omission
2:22|14:32|lafzi
2:23|2:278|structural
2:25|3:15|word_swap
2:27|13:25|lafzi
2:34|20:116|lafzi
2:34|38:74|addition_omission
2:35|7:19|lafzi
2:36|7:24|lafzi
2:37|20:122|word_swap
2:40|5:20|word_swap
2:47|2:122|lafzi
2:48|2:123|order_change
2:49|7:141|lafzi
2:58|7:161|order_change
2:60|7:160|word_swap
2:62|2:274|lafzi
2:62|5:69|order_change
2:63|2:93|lafzi
2:120|13:37|lafzi
2:126|14:35|word_swap
2:134|2:141|lafzi
2:136|3:84|word_swap
2:144|2:150|lafzi
2:146|6:20|lafzi
2:170|31:21|lafzi
2:173|16:115|lafzi
2:197|3:97|lafzi
2:233|65:6|word_swap
2:242|3:103|ending_variation
2:243|40:61|lafzi
2:255|3:2|lafzi
2:255|20:111|lafzi
2:262|2:277|lafzi
2:285|2:286|ending_variation
3:2|20:111|lafzi
3:3|5:48|addition_omission
3:8|3:9|ending_variation
3:10|3:116|lafzi
3:41|19:10|lafzi
3:44|12:102|lafzi
3:47|19:35|word_swap
3:49|5:110|pronoun_shift
3:89|24:5|lafzi
3:103|5:89|ending_variation
3:126|8:10|word_swap
3:164|62:2|lafzi
3:191|3:192|ending_variation
4:13|4:14|ending_variation
4:13|48:17|lafzi
4:36|17:23|order_change
4:43|5:6|lafzi
4:48|4:116|lafzi
4:57|4:122|lafzi
4:61|5:104|lafzi
4:135|5:8|order_change
5:3|16:115|lafzi
5:17|5:72|lafzi
5:64|5:68|lafzi
5:119|98:8|lafzi
6:4|36:46|lafzi
6:10|21:41|lafzi
6:17|10:107|lafzi
6:21|10:17|lafzi
6:30|46:34|lafzi
6:50|11:31|addition_omission
6:56|40:66|lafzi
6:143|6:144|lafzi
6:145|16:115|lafzi
6:151|17:31|word_swap
6:152|17:34|lafzi
6:164|39:7|lafzi
7:12|38:76|lafzi
7:37|10:17|lafzi
7:40|7:41|ending_variation
7:45|11:19|lafzi
7:54|10:3|lafzi
7:54|57:4|lafzi
7:63|7:69|lafzi
7:65|11:50|lafzi
7:73|7:85|lafzi
7:73|11:61|lafzi
7:73|11:64|lafzi
7:78|7:91|lafzi
7:78|29:37|lafzi
7:81|27:55|ending_variation
7:85|11:84|lafzi
7:91|29:37|lafzi
7:188|10:49|order_change
9:33|48:28|lafzi
9:33|61:9|lafzi
9:70|30:9|lafzi
9:73|66:9|lafzi
9:94|62:8|lafzi
9:111|61:10|word_swap
9:114|11:75|addition_omission
10:3|57:4|lafzi
10:24|18:45|lafzi
10:38|11:13|lafzi
10:61|34:3|lafzi
10:93|45:17|lafzi
11:28|11:63|lafzi
11:40|23:27|lafzi
11:90|85:14|lafzi
11:107|11:108|lafzi
11:110|41:45|lafzi
12:22|28:14|lafzi
12:40|53:23|lafzi
12:43|12:46|lafzi
12:109|30:9|lafzi
12:109|35:44|lafzi
12:109|40:82|lafzi
12:109|47:10|lafzi
14:21|40:47|lafzi
15:1|27:1|order_change
15:29|38:72|lafzi
16:43|21:7|lafzi
16:61|35:45|lafzi
16:66|23:21|pronoun_shift
16:78|23:78|lafzi
16:125|53:30|lafzi
16:125|68:7|lafzi
17:9|18:2|word_swap
17:83|41:51|lafzi
18:29|76:3|word_swap
18:72|18:75|addition_omission
18:110|41:6|lafzi
19:15|19:33|pronoun_shift
20:71|26:49|lafzi
20:128|32:26|lafzi
20:130|50:39|word_swap
21:38|36:48|lafzi
21:91|66:12|pronoun_shift
22:8|31:20|lafzi
22:14|22:23|lafzi
22:14|47:12|lafzi
22:23|35:33|lafzi
22:23|47:12|lafzi
22:62|31:30|lafzi
23:5|70:29|lafzi
23:6|70:30|lafzi
23:51|34:11|ending_variation
23:78|32:9|lafzi
23:82|37:16|lafzi
24:61|48:17|lafzi
25:59|32:4|lafzi
26:109|26:127|lafzi
26:109|26:145|lafzi
26:109|26:164|lafzi
26:109|26:180|lafzi
26:127|26:145|lafzi
26:127|26:164|lafzi
26:127|26:180|lafzi
26:145|26:164|lafzi
26:145|26:180|lafzi
26:164|26:180|lafzi
26:173|27:58|lafzi
27:3|31:4|lafzi
27:10|28:31|lafzi
27:19|46:15|lafzi
27:81|30:53|lafzi
27:87|39:68|lafzi
28:20|36:20|order_change
28:46|32:3|lafzi
28:62|28:74|lafzi
29:62|34:36|ending_variation
30:9|35:44|lafzi
30:9|40:82|lafzi
30:9|47:10|lafzi
30:37|39:52|lafzi
30:43|42:47|lafzi
31:14|46:15|word_swap
31:29|35:13|lafzi
31:33|35:5|lafzi
32:9|67:23|lafzi
34:2|57:4|lafzi
35:40|46:4|lafzi
35:44|40:82|lafzi
35:44|47:10|lafzi
36:35|36:73|ending_variation
36:82|40:68|lafzi
37:47|56:19|word_swap
37:59|44:35|word_swap
39:72|40:76|lafzi
40:56|41:36|ending_variation
40:82|47:10|lafzi
41:25|46:18|lafzi
43:83|70:42|lafzi
48:28|61:9|lafzi
52:24|56:17|addition_omission
53:30|68:7|lafzi
54:17|54:22|lafzi
54:22|54:32|lafzi
54:32|54:40|lafzi
55:13|55:16|lafzi
55:13|55:18|lafzi
55:13|55:21|lafzi
55:13|55:23|lafzi
55:16|55:18|lafzi
55:18|55:21|lafzi
55:21|55:23|lafzi
55:23|55:25|lafzi
55:25|55:28|lafzi
55:28|55:30|lafzi
55:30|55:32|lafzi
55:32|55:34|lafzi
55:34|55:36|lafzi
55:36|55:38|lafzi
55:38|55:40|lafzi
55:40|55:42|lafzi
55:42|55:45|lafzi
55:45|55:47|lafzi
55:47|55:49|lafzi
55:49|55:51|lafzi
55:51|55:53|lafzi
55:53|55:55|lafzi
55:55|55:57|lafzi
55:57|55:59|lafzi
55:59|55:61|lafzi
55:61|55:63|lafzi
55:63|55:65|lafzi
55:65|55:67|lafzi
55:67|55:69|lafzi
55:69|55:71|lafzi
55:71|55:73|lafzi
55:73|55:75|lafzi
55:75|55:77|lafzi
56:8|56:27|ending_variation
56:74|56:96|lafzi
56:74|69:52|lafzi
56:74|87:1|word_swap
57:1|59:1|word_swap
57:1|62:1|word_swap
57:21|62:4|lafzi
59:1|61:1|lafzi
59:23|59:24|ending_variation
60:4|60:6|word_swap
60:8|60:9|word_swap
62:1|64:1|lafzi
67:3|71:15|lafzi
68:43|70:44|lafzi
69:19|69:25|word_swap
69:19|84:7|lafzi
73:19|74:54|lafzi
73:19|76:29|word_swap
74:19|80:17|word_swap
74:54|80:11|pronoun_shift
75:31|75:32|word_swap
77:15|77:19|lafzi
77:19|77:24|lafzi
77:24|77:28|lafzi
77:28|77:34|lafzi
77:34|77:37|lafzi
77:37|77:40|lafzi
77:40|77:45|lafzi
77:45|77:47|lafzi
77:47|77:49|lafzi
78:4|78:5|lafzi
78:4|102:3|word_swap
79:15|88:1|word_swap
81:6|82:3|word_swap
82:1|84:1|word_swap
82:13|83:22|lafzi
83:7|83:19|word_swap
84:7|84:10|word_swap
85:1|86:1|word_swap
89:27|89:28|ending_variation
91:9|91:10|word_swap
92:5|92:8|word_swap
93:6|93:8|ending_variation
94:5|94:6|lafzi
95:4|95:5|ending_variation
96:1|96:3|word_swap
99:7|99:8|word_swap
101:6|101:8|word_swap
102:3|102:4|addition_omission
107:4|107:5|addition_omission
109:2|109:4|word_swap
109:3|109:5|lafzi
112:3|112:4|ending_variation
113:1|114:1|word_swap
`.trim();

const relationsByVerse = new Map<string, QuranMutashabihatRelation[]>();
const seenPairs = new Set<string>();

for (const row of PAIR_DATA.split("\n")) {
  const [firstVerseKey, secondVerseKey, category] = row.split("|") as [
    string,
    string,
    QuranMutashabihatCategory,
  ];
  const pairKey = [firstVerseKey, secondVerseKey].sort().join("|");
  if (seenPairs.has(pairKey)) continue;
  seenPairs.add(pairKey);

  relationsByVerse.set(firstVerseKey, [
    ...(relationsByVerse.get(firstVerseKey) ?? []),
    { otherVerseKey: secondVerseKey, category },
  ]);
  relationsByVerse.set(secondVerseKey, [
    ...(relationsByVerse.get(secondVerseKey) ?? []),
    { otherVerseKey: firstVerseKey, category },
  ]);
}

export function getQuranMutashabihat(verseKey: string): QuranMutashabihatRelation[] {
  return relationsByVerse.get(verseKey) ?? [];
}

export function hasQuranMutashabihat(verseKey: string): boolean {
  return (relationsByVerse.get(verseKey)?.length ?? 0) > 0;
}