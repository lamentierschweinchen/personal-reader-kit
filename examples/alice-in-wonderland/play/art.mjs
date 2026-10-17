// Original pen-and-ink game drawings, redrawn for the Alice reader's Rackham direction.
// These are contemporary vector interpretations, not source-edition reproductions.
const ink='#272b2b', paper='#fbfefe', blue='#194b70', tea='#ac7139';
const svg=(body,box='0 0 260 330')=>`<svg viewBox="${box}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">${body}</svg>`;
const hatch=(id,angle=-28,gap=4)=>`<pattern id="${id}" width="${gap}" height="${gap}" patternUnits="userSpaceOnUse" patternTransform="rotate(${angle})"><path d="M0 0v${gap}" stroke="${ink}" stroke-width=".65" opacity=".48"/></pattern>`;
const fine=(d,extra='')=>`<path d="${d}" fill="none" stroke="${ink}" stroke-width=".85" stroke-linecap="round" ${extra}/>`;
const hatchPaths=(paths)=>paths.map(d=>fine(d)).join('');

export const characters={
  hatter:svg(`<defs>${hatch('hat-hatch')}${hatch('coat-hatch',22,5)}<pattern id="coat-check" width="15" height="18" patternUnits="userSpaceOnUse"><path d="M0 1h15M1 0v18M0 5h15M5 0v18" fill="none" stroke="${ink}" stroke-width=".5" opacity=".45"/></pattern></defs>
  <g stroke="${ink}" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5">
    <path d="M54 329l-1-50q7-37 47-49l45-5q37 14 46 56l9 48" fill="#e9e9e3"/>
    <path d="M54 329l-1-50q7-37 47-49l45-5q37 14 46 56l9 48" fill="url(#coat-check)"/>
    <path d="M102 227l23 92 24-92" fill="${paper}"/>
    <path d="M102 228l-17 14 10 28-10 11 34 48M148 225l17 18-13 24 9 12-31 50" fill="#f2f1e9"/>
    <path d="M87 245l8 24-10 12 25 36-33-47 8-8-7-12M159 244l-7 22 9 13-25 38 16-38-9-13z" fill="url(#coat-hatch)" stroke-width=".6"/>
    <path d="M113 249l-20-11-5 19 24 1 6-3 27 3-5-21-19 13z" fill="#9ca9ae"/><path d="M113 247l-3 11 12 1 3-12z" fill="#e3e8e8"/>
    <path d="M108 257l8 17 9-16 5 50-9 15-11-16z" fill="url(#hat-hatch)"/>
    <circle cx="124" cy="280" r="2"/><circle cx="126" cy="299" r="2"/>
    <path d="M72 160q-17-31-2-48 15-20 47-13 44-9 61 25l-6 51-17 33-56 9z" fill="#b6b4a9"/>
    <path d="M78 158q-15-13-18 0-5 17 18 28l12 11M167 157q13-10 16 3 0 12-17 19" fill="#eeeadd"/>
    <path d="M87 135q32-10 74 7l-3 24 2 9 17 16-20 5-6 19-20 14-32-13-10-21-4-23z" fill="#f8f4e9"/>
    <path d="M87 136q-8 20-5 37l10-13 3-23M157 140l7 19 6-14-6-12" fill="url(#hat-hatch)"/>
    <g class="eyes" fill="${ink}" stroke-width=".75"><path d="M100 165q10-10 22-2-12 8-22 2M138 162q9-9 18 0-8 7-18 0" fill="#faf9ee"/><ellipse cx="114" cy="163" rx="2.6" ry="3.6"/><ellipse cx="149" cy="161" rx="2.2" ry="3.3"/></g>
    <g class="brows" fill="none" stroke-width="2"><path d="M99 155q10-7 24-3M138 151l16 3"/></g>
    <path d="M133 162l-5 17 5 9 22 2M153 179l10 9-9 2" fill="none"/>
    <path class="mouth" d="M111 201q20 13 40-1" fill="none" stroke-width="1.7"/>
    ${fine('M111 200l-6 2m36 10-14 6m-26-46 8 5m-10 5 11 7m-14-1 11 8m45 0 7 2m-36-55 11 2M70 161q8-7 8 6l-7 5M105 216l7 6M140 215l-6 7')}
    ${hatchPaths(['M92 146l-3 8m5-5-2 8','M97 191l4 10m-1-13 5 9','M145 207l-2 8m6-10-2 8','M75 139l-8 10m12-12-6 16','M170 136l8-3m-10-1 8-3'])}
    <path d="M64 125L49 34q-3-11 12-15 42-11 101 6l-4 99" fill="#e9e9df"/>
    <path d="M54 35q51-13 103-1l-7 58q-39 5-84-1z" fill="url(#hat-hatch)" stroke="none"/>
    <path d="M67 92q44 8 89-1l2 28q-43 13-92 4z" fill="#b9b7a7"/>
    <path d="M68 98q46 8 85-2M69 116q41 9 83-1" fill="none" stroke-width=".7"/>
    <path d="M38 124q19-11 34-4 55 14 94-7 14-6 26 1l3 10q-16 23-68 24-46 0-90-14z" fill="#ecebdf"/>
    <path d="M39 131q80 26 153-10l2 5q-26 24-79 22-42-2-76-12z" fill="url(#hat-hatch)"/>
    <path d="M128 92l-6-37 29-3 3 39z" fill="#fcfaf1" stroke-width=".9"/>
    <text x="126" y="76" font-family="Georgia,serif" font-size="13" fill="${ink}" stroke="none" transform="rotate(-5 126 76)">10/6</text>
    ${fine('M57 31l10 57M61 32l10 54M153 37l-3 12M80 23q39-1 65 8M42 128q11-3 17-1M169 119l17-1')}
    <path d="M59 315q8-13 26-12l25 12 5 15-18-7-9-1-18 7-13-1zM162 330l3-16q16-12 30 6l1 10" fill="#f8f4e9"/>
    ${fine('M62 317l17-6 13 5M68 322l15-6 14 6M76 326l13-5 12 6M170 327l1-9m5 10 1-12m5 13 1-10M62 280q-2 17 2 26M68 271l4 29M180 278l6 28M177 278l6 26')}
  </g>`),
  hare:svg(`<defs>${hatch('hare-fur',24,4)}${hatch('hare-coat',-26,5)}</defs>
  <g stroke="${ink}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
    <path d="M57 330q-7-37 12-70l32-29 49 1q35 15 43 53l3 45" fill="#d9ddd9"/>
    <path d="M61 329q-6-43 25-75l-6 34 24 42M158 245q26 20 30 81l-28 4" fill="url(#hare-coat)" stroke-width=".6"/>
    <path d="M101 231l20 90 30-87" fill="#faf9ed"/>
    <path d="M102 231l-20 17 13 20-12 12 30 45M151 231l19 15-14 22 9 13-34 46" fill="#f3f3e9"/>
    <path d="M106 249l-16-7-1 16 18-1 8 3 23 4-1-22-20 10z" fill="#62727a"/>
    <path d="M81 151Q56 108 53 56 42 15 60 8q18-2 21 44l24 97M139 139q0-58 18-103 6-32 23-31 20 13-2 51l-13 87" fill="#d1cbbc"/>
    <path d="M82 129Q63 85 62 43q0-24-4-25-5 23 2 43l29 74M151 128q2-56 17-87 10-25 10-25 2 11-8 36l-12 79" fill="#f0eadb" stroke-width=".7"/>
    ${hatchPaths(['M60 33l8 13m-7-2 9 15m-8-4 10 16m-9-4 13 17m-8-5 13 18m-9-6 13 18','M171 36l6-7m-9 17 10-7m-13 20 8-6m-12 19 8-6m-11 17 8-5','M77 113l13 13m-11-4 12 12m64-22 7-10m-8 18 8-10'])}
    <path d="M89 139l-17-8 6 13-17 1 9 9-13 9 13 5-7 17 14-2-1 19q13 27 45 32 39-1 53-20l10-20-4-13 11-5-10-7 4-16-15 2 2-18-16 6q-30-20-56-5z" fill="#e2dccb"/>
    <path d="M73 163l17-12-2 30-7 14-3 12-6-18-7-3zM158 150l13 9 9 16-13 2z" fill="url(#hare-fur)" stroke="none"/>
    <path d="M107 181q15-12 34-1 20-7 30 8l11 7-16 16-24 10-29-4-12-21z" fill="#faf7eb"/>
    <g class="eyes" stroke-width="1"><path d="M91 164q11-11 23 1-14 9-23-1M145 161q10-11 21 2-12 6-21-2" fill="#fdfbf4"/><ellipse cx="106" cy="163" rx="3.4" ry="5.2"/><ellipse cx="153" cy="161" rx="3.2" ry="5.1"/></g>
    <g class="brows" fill="none" stroke-width="1.7"><path d="M89 151l18-4 8 3M145 146l16 5"/></g>
    <path d="M129 184q12-9 22 1l-10 10z" fill="#6a655c"/>
    <path d="M141 195l-2 8" fill="none"/><path class="mouth" d="M118 203q16 12 40-1" fill="none" stroke-width="1.6"/>
    <path d="M131 210l1 10 9-1 1-9" fill="#fffdf3" stroke-width=".8"/>
    ${fine('M82 177l8-3m-7 12 9-4m-6 13 9-6m-4 15 9-6M97 219l10 7m-5-12 10 8m-3-14 12 12M161 219l7-8m-13 11 5-8M121 170l3 9m40-10 6 8')}
    <g fill="none" stroke-width=".6"><path d="M121 194l-48-7M120 200l-50 5M119 206l-42 14M155 192l43-12M155 198l47-1M156 205l43 9"/></g>
    <path d="M73 139l-4-24 11 12-1-20 12 13M161 142l15-19 2 17 12-11-6 24" fill="#e3dcc9" stroke-width=".9"/>
    <path d="M66 330q-2-25 19-25l24 24M152 330q13-25 33-17l10 17" fill="#e2dccb"/>
    ${fine('M72 323l4-12m4 13 3-14m4 15 3-13m76 17 5-13m2 13 5-12m3 14 4-10M91 276l9 32m-6-21 9 29M160 280l-13 31M144 277l-3 16M126 277l3 2m-1 14 3 2')}
  </g>`),
  dormouse:svg(`<defs>${hatch('mouse-fur',-24,4)}${hatch('mouse-waistcoat',26,4)}</defs>
  <g stroke="${ink}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M69 322q-31 8-36-18-5-34 20-37 11 4-2 16-15 18 13 19" fill="none" stroke="#8d8a7c" stroke-width="4"/>
    <path d="M68 329q-4-71 44-84l43 5q31 21 32 79" fill="#e0dfd2"/>
    <path d="M76 325q-6-42 28-63l-5 47 10 20M158 267q21 24 23 62h-21" fill="url(#mouse-fur)" stroke="none"/>
    <path d="M111 251l11 67 27-67 15 13-10 66h-50l-7-67z" fill="#f4f3e9"/>
    <path d="M124 270l19-12 14 9-7 61h-28z" fill="url(#mouse-waistcoat)" stroke="none"/>
    <path d="M112 258l-15-5 1 17 17-3 7 3 20 7 3-19-23 5z" fill="#94a3a8" stroke-width=".8"/>
    <circle cx="127" cy="288" r="1.5"/><circle cx="127" cy="304" r="1.5"/>
    <path d="M90 214q-40-12-36-41 7-27 31-24 26 8 21 35M151 182q-2-31 25-32 29 3 30 27-2 28-37 36" fill="#d5cbbb"/>
    <path d="M88 195q-27-8-23-25 10-15 24-6 14 13-1 31M169 195q-11-26 10-31 18 1 17 16-3 17-27 15" fill="#eee5d5" stroke-width=".8"/>
    ${fine('M65 175q7-10 17-4m-15 10 8-8m2 13 6-12M179 171l7-1m-12 8 12-3m-10 9 10-5')}
    <path d="M87 198q5-25 34-31 39 0 51 34l1 21-11 22-24 16-27-4-22-16-7-20z" fill="#e3dccb"/>
    <path d="M89 199l18-18-5 30-11 20-8-14zM155 181l14 15 2 14-13-11z" fill="url(#mouse-fur)" stroke="none"/>
    <path d="M107 220q21-17 43-1l11 12-10 17-16 9-24-9-12-16z" fill="#faf5e7"/>
    <g class="eyes" fill="none" stroke-width="1.7"><path d="M96 207q11 8 21-3M144 204q10 9 20 1"/></g>
    <g class="brows" fill="none" stroke-width="1.2"><path d="M98 196l14-2M148 194l12 3"/></g>
    <path d="M122 224q10-9 21 0l-10 9z" fill="#686052"/><path d="M133 233l-1 8" fill="none"/>
    <path class="mouth" d="M121 241q11 9 23-3" fill="none" stroke-width="1.1"/>
    <g fill="none" stroke-width=".55"><path d="M119 232l-43-4M119 237l-47 9M119 241l-39 15M146 229l42-8M146 235l45 5M145 241l41 14"/></g>
    ${fine('M111 178l3 9m5-13 3 9m7-10 1 9m8-6-2 9m8-4-1 9M89 221l6 7m-4 0 6 7m-3 0 6 8m-1-2 6 8m47-5 6-6m-4 0 7-8M114 251l7 3m16-2 7-2')}
    <path d="M79 330q-3-19 12-20l23 20M144 330q14-24 28-16l8 16" fill="#e3dccb"/>
    ${fine('M85 324l1-9m4 11 2-11m3 13 2-10M154 328l4-11m1 11 4-10m2 12 3-9M83 285l3 15m-7-10 3 13M169 284l-3 18')}
  </g>`)
};

export function cupArt(id){return svg(`<defs>${hatch(`china-shade-${id}`,36,4)}<clipPath id="cup-clip-${id}"><path d="M31 44h119l-9 56q-5 34-50 34T40 100z"/></clipPath></defs>
  <ellipse cx="93" cy="145" rx="81" ry="15" fill="#c1cbd0" opacity=".18"/>
  <ellipse class="saucer" cx="91" cy="137" rx="79" ry="18" fill="${paper}" stroke="${blue}" stroke-width="1.4"/>
  <ellipse cx="91" cy="137" rx="72" ry="13" fill="none" stroke="${blue}" stroke-width=".7"/>
  <ellipse cx="91" cy="137" rx="52" ry="8" fill="none" stroke="#899a9e" stroke-width=".8"/>
  <path d="M147 57q42-9 36 21-4 24-41 24l3-13q24 1 24-14 0-11-23-4" fill="${paper}" stroke="${blue}" stroke-width="1.5"/>
  <path d="M154 62q25-6 22 12M151 96q20-2 25-14" stroke="${blue}" stroke-width=".55" fill="none"/>
  <path d="M31 44h119l-9 56q-5 34-50 34T40 100z" fill="#f3f4ee" stroke="${ink}" stroke-width="1.35"/>
  <g clip-path="url(#cup-clip-${id})"><rect class="tea-fill" x="26" y="83" width="130" height="70" fill="${tea}"/><ellipse class="tea-surface" cx="91" cy="83" rx="65" ry="7" fill="#d3a464"/><path d="M46 54l8 45" stroke="#fffef5" stroke-width="5" opacity=".6" stroke-linecap="round"/>
  <path d="M131 54l-7 47q-5 16-22 20M137 54l-8 50q-5 16-19 23" fill="none" stroke="#4e4c40" stroke-width=".6" opacity=".45"/>
  </g>
  <path class="fill-line" d="M34 58h112" stroke="${blue}" stroke-width="2" stroke-dasharray="4 5" opacity=".8"/>
  <ellipse cx="91" cy="43" rx="60" ry="8" fill="none" stroke="${blue}" stroke-width="1.8"/>
  <ellipse cx="91" cy="43" rx="56" ry="5" fill="none" stroke="${blue}" stroke-width=".6"/>
  <g stroke="${blue}" fill="none" stroke-width=".9"><path d="M29 134q10-11 23 0m-17-3q-5-7 1-9m9 10q4-10 10-9M132 135q10-11 23 0m-17-3q-5-7 1-9m9 10q4-10 10-9M64 149q27 8 56-1"/><path d="M74 133q17 6 34-1"/></g>
  <path class="steam" d="M76 30q-10-10 0-20m27 18q10-10 0-22" fill="none" stroke="#617d8a" stroke-width="1.5" stroke-linecap="round"/>
  <g class="spill-drops" fill="${tea}"><path d="M41 76q-14 25-3 27t3-27M151 81q-10 20 0 22t0-22"/><ellipse cx="128" cy="145" rx="26" ry="5"/></g>
  `,'0 0 200 165');}

export const kettleArt=svg(`<defs>${hatch('kettle-clip-shade',25,4)}<clipPath id="kettle-clip"><path d="M58 75q45-15 88 1l7 66q-44 27-97 0z"/></clipPath></defs>
  <g stroke="${ink}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round">
  <path d="M143 77q67-19 60 29-3 31-49 28l-1-15q34 2 35-19 2-24-42-10" fill="#eef1ed"/>
  <path d="M151 81q46-11 44 19-2 24-38 26" fill="none" stroke="${blue}" stroke-width="1"/>
  <path d="M63 91L33 77 10 45l-8 8 18 48 38 31" fill="#edf0e9"/>
  <path d="M6 53l21 41 32 20M22 80l12 9 19 6" fill="none" stroke="${blue}" stroke-width=".8"/>
  <path d="M58 75q45-15 88 1l7 66q-44 27-97 0z" fill="#f5f5ec"/>
  <g clip-path="url(#kettle-clip)" stroke="none"><rect class="kettle-tea" x="50" y="80" width="115" height="80" fill="${tea}"/><path d="M70 84v41" stroke="#fffdf4" stroke-width="7" stroke-linecap="round" opacity=".65"/><path d="M137 78l9 67-15 5-9-72z" fill="url(#kettle-clip-shade)" opacity=".7"/></g>
  <path d="M51 76q52-17 101 0l-1-13q-51-22-98 0z" fill="#f8faf3"/><path d="M91 54v-9q10-10 20 0v9" fill="#c6d7de"/>
  <path d="M58 140q49 17 94 0v12q-46 17-94 0z" fill="#f7f9f3"/>
  <path d="M55 66q46-16 93 1M57 71q44-15 90 1M61 147q45 14 87-1" fill="none" stroke="${blue}" stroke-width="1.3"/>
  <path d="M71 65q11-7 21-2m14-2 16 2m11 3 9 3" fill="none" stroke="${blue}" stroke-width=".8"/>
  </g>`,'0 0 215 175');

// Irregular branching, hatching and pale linen replace the flat green garden.
const twigs=[
 'M15 0q-20 153 77 297l-23-95 3-70-20-63M38 0q8 141 65 246M25 59l69 29 45-27m-49 28 54 29 46-10M48 124l70 5 37 29M54 164l-28 52m42-14 52-4 48 32',
 'M1182 0q29 178-73 344l37-135-1-79 24-83M1163 2q-4 140-54 259M1167 75l-75 16-37-29m44 33-73 38-52-18M1146 155l-77 6-41 44m51-45-20-35M1119 221l-41 3-42 44',
 'M330 0l-28 50-52 29-17 41m69-71 48 27 40 1m-109-18-16-29M864 0l31 43 39 25 22 49m-60-73-39 31-42 5m74-28 5-32',
 'M77 8l35 22 22 44m-21-45 41-17M1132 5l-46 30-14 45m18-49-36-4',
 'M5 349q59-31 117-9m-111-1 16-9m-9 16 23-16m11 8 17-9M1087 378q53-25 107-17m-95 9 13-13m7 7 16-14m13 11 10-15'
];
const leaves=Array.from({length:26},(_,i)=>{
 const left=i<13, n=i%13, x=(left?55+n*13:1148-n*13), y=45+(n%5)*35;
 return `<path d="M${x} ${y}q${left?22:-22} -19 ${left?34:-34} 4q${left?-19:19} 14 ${left?-34:34}-4m0 0l${left?27:-27} 3" fill="#f0f2eb" stroke="#53564f" stroke-width=".85"/>`;
}).join('');
export const garden=svg(`<defs>${hatch('bark-hatch',-12,5)}<pattern id="linen" width="67" height="53" patternUnits="userSpaceOnUse"><path d="M5 17h9m28 23h7M29 2v5" stroke="#a5aaa1" stroke-width=".55" opacity=".25"/></pattern></defs>
  <rect width="1200" height="700" fill="${paper}"/>
  <g fill="#eff2ed"><path d="M0 362q127-50 222-7 149-60 272-6 128-59 247 2 133-51 254-2 126-42 205 20v130H0z"/></g>
  <g fill="none" stroke="${ink}" stroke-width="1.7" stroke-linecap="round">${twigs.map(d=>`<path d="${d}"/>`).join('')}</g>
  <path d="M0 0h16q-10 176 70 291l-19-77Q1 89 0 0M1200 0h-18q27 182-67 333l31-131q39-93 54-202" fill="url(#bark-hatch)" stroke="#2c302e" stroke-width="1"/>
  ${leaves}
  <g fill="none" stroke="#71786b" stroke-width=".7" opacity=".7"><path d="M4 387q100-25 192-12M981 393q118-22 216-8M32 373l7-13m6 13 12-20m9 18 7-11m1003 27 10-19m1 18 9-12m2 13 16-16M204 344q80-11 147 3M846 344q57-13 132 5"/></g>
  <path d="M44 448Q600 304 1156 448l101 252H-57z" fill="#f9f8ef" stroke="#424b4d" stroke-width="1.8"/>
  <path d="M44 448Q600 304 1156 448l101 252H-57z" fill="url(#linen)"/>
  <g fill="none" stroke="#999d90" stroke-width=".8"><path d="M39 452Q600 311 1160 452M25 481q558-129 1149-1M-12 625q614 78 1225 0M-14 630q614 78 1226 0M155 422l-38 278M159 420l-30 280M1021 422l44 278M1028 424l48 276M510 376l-13 94m9-92-9 75M710 379l19 89"/><path d="M61 467l-23 64m24-54-20 64m1110-69 30 60m-26-51 24 57M-8 667l146-19m-141 24 138-19M1061 650l149 17m-146-11 143 17"/></g>
  <g class="table-props" fill="#faf9f2" stroke="#535b5c" stroke-width="1.1">
   <ellipse cx="1005" cy="603" rx="56" ry="15"/><ellipse cx="1005" cy="603" rx="50" ry="11" stroke="#194b70" stroke-width=".6"/>
   <path d="M977 591l41-29 24 22-42 29z" fill="#e2ce9d"/><path d="M982 587l34-20 19 16-35 23z" fill="#f0e2b4"/>
   <path d="M137 590l30-2 7 38-34 2zM142 589l2-8 19-1 4 8"/>
   <path d="M142 600l26-2m-25 7 26-2" fill="none" stroke="#194b70" stroke-width=".65"/>
  </g>
  <g fill="none" stroke="#686f65" stroke-width=".5" opacity=".6"><path d="M104 387l-5-12m11 12-3-17m9 16 3-12M1035 397l5-15m1 15 10-12M197 372q8-18 16-1m-17-4q11-10 19-1"/></g>
  `,'0 0 1200 700');
