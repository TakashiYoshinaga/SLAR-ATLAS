export const UI_TEXT = {
  ja: {
    bodiesTab:'天体',infoTab:'解説',settingsTab:'表示',close:'閉じる',displayHelp:'軌道線・ラベル・見かけの軌跡の表示を切り替えます。',touchRotate:'1本指で回転',touchZoom:'ピンチでズーム',touchPan:'2本指で移動',touchHint:'1本指で回転 · ピンチでズーム',
    errorTitle:'太陽系を表示できませんでした',retry:'もう一度読み込む',
    title:'SOLAR ATLAS — 太陽系を探索',description:'太陽と8つの惑星、そして月。タッチやマウスで自由に探索できる、小さな太陽系。',
    appLabel:'太陽系の3D探索',sceneLabel:'ドラッグで回転、ホイールでズームできる太陽系',canvasLabel:'太陽系の3Dビュー。天体は右側の一覧からも選択できます。',labelsLabel:'天体名',homeLabel:'Solar Atlas ホーム',explorerLabel:'天体の紹介',sourceLabel:'公転周期の出典：NASA / JPL（別タブで開く）',sourceTitle:'公転周期の出典：NASA / JPL',navLabel:'天体を選択',toolbarLabel:'シミュレーション操作',
    edition:'太陽系を探索',sceneTitle:'太陽系',sceneCaption:'ひとつの恒星と、8つの惑星。',sceneEyebrow:'OUR COSMIC NEIGHBORHOOD',overviewMode:'SYSTEM OVERVIEW',focusMode:'BODY IN FOCUS',overviewCategory:'私たちの太陽系',overviewName:'太陽系',overviewSecondary:'THE SOLAR SYSTEM',overviewDescription:'太陽をめぐる8つの惑星と、地球に寄り添う月。天体を選んで、その表情や動きを近くから眺めてみましょう。',
    planets:'惑星',shownMoon:'表示中の衛星',type:'天体の種類',orbitingPlanets:'まわりの惑星',star:'恒星',selectBody:'天体を選ぶ',bodyCount:'10 天体',rotate:'ドラッグで回転',zoom:'スクロールでズーム',pan:'右ドラッグで移動',tracking:'選択した天体を追従中',speed:'再生速度',orbits:'軌道線',labels:'ラベル',trails:'見かけの軌跡',trailsTitle:'選んだ天体から見た、ほかの天体の動きを描きます（軌道線を消すと見やすくなります）',reset:'全体に戻る',resetTitle:'全体に戻る（Esc）',pause:'一時停止',play:'再生',playTitle:'一時停止 / 再生（Space）',speedAria:'再生速度',
    earthYear:'地球の1年',seconds:'秒',elapsed:'経過',earthYears:'地球年',scaleNote:'サイズ・距離・自転速度は見やすく調整',footer:'SCROLL CLOSER. DISCOVER MORE.',sunPeriod:'太陽をめぐる周期',moonPeriod:'地球をめぐる周期',earthRatio:'地球の公転との比',spinOrbit:'自転と公転',days:'日',times:'倍',synchronous:'同期',profile:'',exploreBody:name=>`${name}に接近する`,
  },
  en: {
    bodiesTab:'Bodies',infoTab:'Info',settingsTab:'Display',close:'Close',displayHelp:'Show or hide orbit lines, labels, and apparent trails.',touchRotate:'One finger to orbit',touchZoom:'Pinch to zoom',touchPan:'Two fingers to pan',touchHint:'Drag to orbit · Pinch to zoom',
    errorTitle:'Unable to display the solar system',retry:'Reload',
    title:'SOLAR ATLAS — Explore the Solar System',description:'Explore the Sun, eight planets, and the Moon from any angle in an interactive 3D solar system.',
    appLabel:'Interactive 3D solar system',sceneLabel:'Drag to orbit and scroll to zoom through the solar system',canvasLabel:'3D solar system view. You can also select a body from the list on the right.',labelsLabel:'Celestial body labels',homeLabel:'Solar Atlas home',explorerLabel:'Celestial body guide',sourceLabel:'Orbital period source: NASA / JPL (opens in a new tab)',sourceTitle:'Orbital period source: NASA / JPL',navLabel:'Select a celestial body',toolbarLabel:'Simulation controls',
    edition:'Explore the Solar System',sceneTitle:'Solar System',sceneCaption:'One star. Eight planets.',sceneEyebrow:'OUR COSMIC NEIGHBORHOOD',overviewMode:'SYSTEM OVERVIEW',focusMode:'BODY IN FOCUS',overviewCategory:'Our solar system',overviewName:'Solar System',overviewSecondary:'THE SOLAR SYSTEM',overviewDescription:'Eight planets orbit the Sun, with the Moon beside Earth. Choose a celestial body and look closely at its surface and motion.',
    planets:'Planets',shownMoon:'Moon shown',type:'Body type',orbitingPlanets:'Orbiting planets',star:'Star',selectBody:'Select a body',bodyCount:'10 BODIES',rotate:'Drag to orbit',zoom:'Scroll to zoom',pan:'Right-drag to pan',tracking:'Tracking selected body',speed:'Playback speed',orbits:'Orbits',labels:'Labels',trails:'Apparent path',trailsTitle:'Trace how the other bodies move as seen from the selected body',reset:'System view',resetTitle:'Return to system view (Esc)',pause:'Pause',play:'Play',playTitle:'Pause / play (Space)',speedAria:'Playback speed',
    earthYear:'1 Earth year',seconds:'sec',elapsed:'Elapsed',earthYears:'Earth years',scaleNote:'Sizes, distances, and rotation speeds are adjusted for viewing',footer:'SCROLL CLOSER. DISCOVER MORE.',sunPeriod:'Orbit around the Sun',moonPeriod:'Orbit around Earth',earthRatio:"vs. Earth's orbit",spinOrbit:'Rotation & orbit',days:'DAYS',times:'×',synchronous:'SYNCHRONOUS',profile:'CELESTIAL PROFILE',exploreBody:name=>`Explore ${name}`,
  },
};

export function textFor(language) { return UI_TEXT[language] ?? UI_TEXT.ja; }
export function bodyName(body,language) {
  if (language==='ja') return body.name;
  return body.english.charAt(0)+body.english.slice(1).toLowerCase();
}
export function bodyCategory(body,language) { return language==='ja'?body.category:body.categoryEn; }
export function bodyDescription(body,language) { return language==='ja'?body.description:body.descriptionEn; }
export function timeScaleText(language,speed,earthYearSeconds) {
  const seconds=Number((earthYearSeconds/speed).toFixed(1));
  const t=textFor(language);
  return language==='ja'?`${t.earthYear} = ${seconds}${t.seconds}`:`${t.earthYear} = ${seconds} ${t.seconds}`;
}
