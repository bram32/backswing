/* Backswing — exercise figures
   Side-view line drawings built from joint coordinates on a 120 x 120 grid.
   Each pose: head, neck, hip, legs [[knee, ankle]...], arms [[elbow, hand]...],
   optional shoulder override, props, floor line, torso curve, and which parts to highlight. */

const POSES = {
  stand:        { head:[60,18], neck:[60,30], hip:[60,66], legs:[[[57,90],[56,112]],[[63,90],[64,112]]], arms:[[[58,50],[57,68]],[[63,50],[64,68]]], floor:112, hi:['torso'] },
  standClub:    { head:[60,18], neck:[60,30], hip:[60,66], legs:[[[57,90],[56,112]],[[63,90],[64,112]]], arms:[[[45,36],[38,28]],[[75,36],[82,28]]], props:[{l:[[30,28],[90,28]]}], floor:112, hi:['torso'] },
  legSwing:     { head:[58,18], neck:[58,30], hip:[60,66], legs:[[[58,90],[58,112]],[[74,78],[90,64]]], arms:[[[72,44],[86,40]],[[55,52],[52,70]]], props:[{l:[[88,18],[88,112]]}], floor:112, hi:['leg1'] },
  hinge:        { head:[28,40], neck:[36,46], hip:[62,70], legs:[[[60,92],[58,112]],[[66,92],[66,112]]], arms:[[[42,58],[50,42]],[[56,66],[66,66]]], props:[{l:[[20,34],[72,80]]}], floor:112, hi:['torso'] },
  lungeReach:   { head:[48,30], neck:[52,40], hip:[66,66], legs:[[[44,84],[40,112]],[[86,86],[104,112]]], arms:[[[48,62],[46,112]],[[52,22],[58,4]]], floor:112, hi:['torso'] },
  quadruped:    { head:[24,50], neck:[36,56], hip:[84,58], legs:[[[90,88],[112,90]]], arms:[[[34,72],[34,90]]], floor:90, curve:-10, hi:['torso'] },
  birddog:      { head:[28,48], neck:[42,54], hip:[82,56], legs:[[[86,86],[108,88]],[[100,56],[118,58]]], arms:[[[44,72],[44,90]],[[24,50],[6,46]]], floor:90, hi:['torso'] },
  threadNeedle: { head:[28,64], neck:[40,58], hip:[82,56], legs:[[[88,86],[110,88]]], arms:[[[44,74],[44,90]],[[60,74],[72,86]]], floor:90, hi:['arm1'] },
  supineKnees:  { head:[16,86], neck:[26,86], hip:[62,86], legs:[[[78,66],[92,90]],[[82,68],[96,90]]], arms:[[[38,88],[50,90]]], floor:92, hi:['hip'] },
  bridge:       { head:[16,88], neck:[26,84], hip:[62,68], legs:[[[78,62],[90,90]]], arms:[[[38,90],[52,90]]], floor:92, hi:['hip'] },
  deadbug:      { head:[18,86], neck:[28,84], hip:[62,86], legs:[[[70,64],[88,64]],[[86,80],[110,80]]], arms:[[[30,66],[32,46]],[[16,68],[4,60]]], floor:92, hi:['torso'] },
  sidePlank:    { head:[18,44], neck:[28,48], hip:[66,66], legs:[[[88,78],[110,90]]], arms:[[[28,70],[30,90]],[[28,30],[30,12]]], floor:90, hi:['torso'] },
  sideLying:    { head:[16,60], neck:[26,62], hip:[64,66], legs:[[[80,84],[68,96]]], arms:[[[40,60],[56,56]],[[30,42],[20,24]]], props:[{a:[[56,56],[20,24]]}], floor:98, hi:['torso'] },
  halfKneel:    { head:[52,20], neck:[54,32], hip:[56,66], legs:[[[32,68],[30,100]],[[66,100],[96,100]]], arms:[[[52,48],[56,64]]], floor:102, hi:['hip'] },
  seated9090:   { head:[48,28], neck:[50,40], hip:[54,86], legs:[[[30,84],[26,100]],[[80,84],[96,100]]], arms:[[[62,62],[74,90]]], floor:100, hi:['hip'] },
  childsPose:   { head:[18,80], neck:[30,78], hip:[78,70], legs:[[[88,98],[112,98]]], arms:[[[20,90],[4,96]]], floor:98, curve:-6, hi:['torso'] },
  wallAngel:    { head:[60,18], neck:[60,30], hip:[60,66], legs:[[[57,90],[56,112]],[[63,90],[64,112]]], arms:[[[40,32],[40,12]]], props:[{l:[[68,8],[68,112]]}], floor:112, hi:['arm0'] },
  chairExt:     { head:[44,26], neck:[52,36], hip:[62,74], legs:[[[36,74],[36,100]]], arms:[[[38,32],[44,20]]], props:[{l:[[72,50],[72,100]]},{l:[[44,76],[72,76]]},{l:[[46,76],[46,100]]}], floor:100, hi:['torso'] },
  splitSquat:   { head:[60,18], neck:[60,30], hip:[60,68], legs:[[[40,84],[38,112]],[[80,90],[96,112]]], arms:[[[58,50],[58,68]]], floor:112, hi:['leg0'] },
  singleLegRDL: { head:[22,44], neck:[30,50], hip:[64,66], legs:[[[64,90],[62,112]],[[90,60],[112,52]]], arms:[[[34,66],[36,88]]], floor:112, hi:['torso','leg1'] },
  crossBody:    { head:[60,18], neck:[60,30], hip:[60,66], legs:[[[57,90],[56,112]],[[63,90],[64,112]]], arms:[[[46,44],[78,42]],[[74,52],[62,40]]], floor:112, hi:['arm0'] },
  wristStretch: { head:[58,18], neck:[58,30], hip:[58,66], legs:[[[55,90],[54,112]],[[61,90],[62,112]]], arms:[[[78,40],[98,40]],[[80,56],[102,46]]], floor:112, hi:['arm0'] },
  bandER:       { head:[58,18], neck:[58,30], hip:[58,66], legs:[[[55,90],[54,112]],[[61,90],[62,112]]], arms:[[[58,52],[82,52]]], props:[{l:[[8,52],[82,52]],d:true}], floor:112, hi:['arm0'] },
  chinTuck:     { head:[64,18], neck:[60,30], hip:[60,66], legs:[[[57,90],[56,112]],[[63,90],[64,112]]], arms:[[[58,50],[57,68]]], props:[{a:[[80,18],[70,18]]}], floor:112, hi:['head'] },
  wallSit:      { head:[62,26], neck:[64,38], hip:[68,74], legs:[[[40,74],[40,104]]], arms:[[[62,56],[54,72]]], props:[{l:[[72,10],[72,104]]}], floor:104, hi:['leg0'] },
  calfRaise:    { head:[60,14], neck:[60,26], hip:[60,62], legs:[[[57,86],[58,104]],[[63,86],[64,104]]], arms:[[[74,44],[88,40]]], props:[{l:[[90,18],[90,112]]},{l:[[52,112],[66,104]]}], floor:112, hi:['leg0'] },
  figure4Stand: { head:[56,20], neck:[58,32], hip:[62,68], legs:[[[60,90],[60,112]],[[36,84],[58,88]]], arms:[[[78,44],[90,42]]], props:[{l:[[92,18],[92,112]]}], floor:112, hi:['hip'] },
  hamstringStand:{ head:[36,40], neck:[44,46], hip:[64,66], legs:[[[62,90],[60,112]],[[82,72],[96,88]]], arms:[[[46,66],[50,88]]], props:[{r:[84,90,20,22]}], floor:112, hi:['leg1'] },
  latStretch:   { head:[44,36], neck:[50,42], hip:[70,70], legs:[[[66,90],[64,112]]], arms:[[[62,40],[98,34]]], props:[{l:[[100,18],[100,112]]}], floor:112, hi:['torso'] },
  swing:        { head:[54,24], neck:[56,36], hip:[62,70], legs:[[[52,92],[48,112]],[[74,92],[78,112]]], arms:[[[36,44],[22,30]],[[42,50],[24,34]]], props:[{l:[[22,30],[84,8]]}], floor:112, hi:['torso'] },
  curlUp:       { head:[18,84], neck:[28,84], hip:[62,88], legs:[[[80,68],[90,90]],[[86,88],[112,90]]], arms:[[[44,88],[58,90]]], floor:92, hi:['torso'] },
  pallof:       { head:[58,18], neck:[58,30], hip:[58,66], legs:[[[55,90],[54,112]],[[61,90],[62,112]]], arms:[[[64,48],[86,48]]], props:[{l:[[6,48],[86,48]],d:true}], floor:112, hi:['torso'] },
  ytw:          { head:[16,86], neck:[26,86], hip:[62,88], legs:[[[88,88],[112,88]]], arms:[[[16,74],[4,62]]], floor:92, hi:['arm0'] },
  squatTee:     { head:[58,22], neck:[60,34], hip:[66,70], legs:[[[44,80],[46,112]]], arms:[[[50,20],[46,6]]], props:[{l:[[26,6],[66,6]]}], floor:112, hi:['hip'] },
  armCircles:   { head:[58,18], neck:[58,30], hip:[58,66], legs:[[[55,90],[54,112]],[[61,90],[62,112]]], arms:[[[78,36],[94,22]]], props:[{a:[[94,22],[70,8]]}], floor:112, hi:['arm0'] },
  wristCurl:    { head:[56,26], neck:[58,38], hip:[66,74], legs:[[[40,74],[40,104]]], arms:[[[48,60],[28,66]]], props:[{l:[[72,50],[72,104]]},{l:[[44,76],[72,76]]},{c:[26,72,4]}], floor:104, hi:['arm0'] },
  pronation:    { head:[58,18], neck:[58,30], hip:[58,66], legs:[[[55,90],[54,112]],[[61,90],[62,112]]], arms:[[[60,54],[80,54]]], props:[{l:[[80,54],[80,10]]}], floor:112, hi:['arm0'] },
  hipAirplane:  { head:[22,44], neck:[30,50], hip:[64,66], legs:[[[64,90],[62,112]],[[90,60],[112,52]]], arms:[[[36,64],[24,80]],[[36,42],[40,20]]], props:[{a:[[96,44],[84,28]]}], floor:112, hi:['hip'] },
  kneesSide:    { head:[16,88], neck:[26,86], hip:[62,86], legs:[[[80,64],[98,74]]], arms:[[[36,84],[48,84]]], props:[{a:[[92,50],[104,66]]}], floor:92, hi:['hip'] },
  sleeper:      { head:[16,60], neck:[26,62], hip:[64,66], legs:[[[80,84],[68,96]]], arms:[[[44,62],[44,84]],[[36,52],[52,78]]], floor:98, hi:['arm0'] },
  stepBack:     { head:[58,18], neck:[58,30], hip:[60,68], legs:[[[44,84],[42,112]],[[82,90],[100,112]]], arms:[[[60,18],[64,4]]], floor:112, hi:['hip'] },
  neckStretch:  { head:[54,18], neck:[60,30], hip:[60,66], legs:[[[57,90],[56,112]],[[63,90],[64,112]]], arms:[[[78,30],[62,12]],[[48,50],[44,72]]], floor:112, hi:['neck'] },
  squeeze:      { head:[58,18], neck:[58,30], hip:[58,66], legs:[[[55,90],[54,112]],[[61,90],[62,112]]], arms:[[[64,52],[82,44]]], props:[{c:[86,42,5]}], floor:112, hi:['arm0'] },
  doorway:      { head:[56,18], neck:[58,30], hip:[60,66], legs:[[[57,90],[56,112]],[[63,90],[64,112]]], arms:[[[76,32],[88,22]]], props:[{l:[[90,8],[90,112]]}], floor:112, hi:['arm0'] }
};

/* Build an SVG string for a pose. Highlighted parts use the accent colour. */
function figureSVG(poseKey, opts = {}) {
  const p = POSES[poseKey] || POSES.stand;
  const size = opts.size || 120;
  const hi = new Set(p.hi || []);
  const sh = p.shoulder || [p.neck[0], p.neck[1] + 4];
  const cls = (k) => hi.has(k) ? 'fig-hi' : 'fig';
  const out = [];
  out.push(`<svg class="figure" viewBox="0 0 120 120" width="${size}" height="${size}" role="img" aria-label="${opts.label || poseKey}">`);
  if (p.floor) out.push(`<line class="fig-floor" x1="0" y1="${p.floor}" x2="120" y2="${p.floor}"/>`);
  (p.props || []).forEach(pr => {
    if (pr.l) out.push(`<line class="fig-prop${pr.d ? ' fig-dash' : ''}" x1="${pr.l[0][0]}" y1="${pr.l[0][1]}" x2="${pr.l[1][0]}" y2="${pr.l[1][1]}"/>`);
    if (pr.r) out.push(`<rect class="fig-prop" x="${pr.r[0]}" y="${pr.r[1]}" width="${pr.r[2]}" height="${pr.r[3]}" rx="2"/>`);
    if (pr.c) out.push(`<circle class="fig-prop" cx="${pr.c[0]}" cy="${pr.c[1]}" r="${pr.c[2]}"/>`);
    if (pr.a) {
      const [a, b] = pr.a; const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0], dy = b[1] - a[1]; const cx = mx - dy * 0.35, cy = my + dx * 0.35;
      out.push(`<path class="fig-arrow" d="M${a[0]} ${a[1]} Q${cx} ${cy} ${b[0]} ${b[1]}" marker-end="url(#fig-arrowhead)"/>`);
    }
  });
  // legs
  (p.legs || []).forEach((leg, i) => {
    out.push(`<polyline class="${cls('leg' + i)}" points="${p.hip[0]},${p.hip[1]} ${leg[0][0]},${leg[0][1]} ${leg[1][0]},${leg[1][1]}"/>`);
  });
  // torso
  if (p.curve) {
    const mx = (p.neck[0] + p.hip[0]) / 2, my = (p.neck[1] + p.hip[1]) / 2;
    out.push(`<path class="${cls('torso')}" d="M${p.neck[0]} ${p.neck[1]} Q${mx} ${my + p.curve} ${p.hip[0]} ${p.hip[1]}"/>`);
  } else {
    out.push(`<line class="${cls('torso')}" x1="${p.neck[0]}" y1="${p.neck[1]}" x2="${p.hip[0]}" y2="${p.hip[1]}"/>`);
  }
  // arms
  (p.arms || []).forEach((arm, i) => {
    out.push(`<polyline class="${cls('arm' + i)}" points="${sh[0]},${sh[1]} ${arm[0][0]},${arm[0][1]} ${arm[1][0]},${arm[1][1]}"/>`);
  });
  // neck + head
  out.push(`<line class="${cls('neck')}" x1="${p.neck[0]}" y1="${p.neck[1]}" x2="${p.head[0]}" y2="${p.head[1] + 6}"/>`);
  out.push(`<circle class="${cls('head')} fig-head" cx="${p.head[0]}" cy="${p.head[1]}" r="6"/>`);
  out.push('</svg>');
  return out.join('');
}

/* One shared arrowhead marker for the whole document. */
function figureDefs() {
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
    <marker id="fig-arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L5,3 L0,6" class="fig-arrow-head"/>
    </marker></defs></svg>`;
}
