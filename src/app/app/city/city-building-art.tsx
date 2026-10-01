import type { BuildingKey } from "@/features/city/domain";
import styles from "./city.module.css";

type ArtProps = { kind: BuildingKey; level: number };

function Block({ x, y, width, height, tone = "stone" }: { x: number; y: number; width: number; height: number; tone?: "stone" | "glass" | "warm" }) {
  const depth = 13;
  return <g className={styles[tone]}>
    <path className={styles.blockSide} d={`M${x + width} ${y}l${depth} -7v${height}l-${depth} 7Z`} />
    <path className={styles.blockFront} d={`M${x} ${y}h${width}v${height}h-${width}Z`} />
    <path className={styles.blockTop} d={`M${x} ${y}l${depth} -7h${width}l-${depth} 7Z`} />
  </g>;
}

function Windows({ x, y, columns, rows, stepX = 18, stepY = 18 }: { x: number; y: number; columns: number; rows: number; stepX?: number; stepY?: number }) {
  return <g className={styles.artWindows}>{Array.from({ length: columns * rows }, (_, index) =>
    <rect key={index} x={x + index % columns * stepX} y={y + Math.floor(index / columns) * stepY} width="8" height="10" rx="2" />)}</g>;
}

/** Pure vector scenery. Levels are passed from the owner-scoped City read model. */
export function CityBuildingArt({ kind, level }: ArtProps) {
  return <svg className={styles.buildingShape} data-art-kind={kind} data-art-level={level} viewBox="0 0 200 190" aria-hidden="true" focusable="false">
    <ellipse className={styles.artShadow} cx="101" cy="168" rx="85" ry="16" />
    <path className={styles.artPlatformSide} d="M13 145 99 105l89 40v16l-89 27-86-27Z" />
    <path className={styles.artPlatform} d="M13 145 99 105l89 40-89 31Z" />
    <path className={styles.artPlaza} d="M31 145 99 115l70 30-70 23Z" />
    {kind === "knowledge_center" && <>
      <Block x={49} y={level >= 2 ? 72 : 83} width={92} height={level >= 2 ? 64 : 53} tone="warm" />
      <path className={styles.artPediment} d="M42 76 95 48l53 28Z" />
      <path className={styles.artTrim} d="M44 82h103M60 98h76M60 131h76" />
      {[64, 84, 105, 125].map(x => <path key={x} className={styles.artColumns} d={`M${x} 99v31`} />)}
      <path className={styles.artDoor} d="M89 112h14v23H89Z" />
      {level >= 3 && <><path className={styles.artGold} d="M94 47V34m-8 0h16M43 75l-8 6m111-6 8 6" /><circle className={styles.artGoldFill} cx="95" cy="32" r="4" /></>}
    </>}
    {kind === "focus_tower" && <>
      <Block x={66} y={level >= 2 ? 31 : 47} width={61} height={level >= 2 ? 112 : 96} tone="glass" />
      <path className={styles.artTowerFace} d={`M97 ${level >= 2 ? 31 : 47}v111`} />
      <Windows x={75} y={level >= 2 ? 45 : 60} columns={3} rows={level >= 2 ? 5 : 4} stepX={17} stepY={18} />
      <path className={styles.artTrim} d="M60 143h76M81 132h31" />
      {level >= 2 && <Block x={49} y={102} width={18} height={40} tone="glass" />}
      {level >= 3 && <><path className={styles.artGold} d="M96 29V12m-8 8h16" /><circle className={styles.artGoldFill} cx="96" cy="10" r="5" /></>}
    </>}
    {kind === "library_district" && <>
      <Block x={45} y={level >= 2 ? 70 : 84} width={102} height={level >= 2 ? 67 : 53} tone="warm" />
      <path className={styles.artRoof} d="M39 82 96 46l57 36-13 4-44-26-44 26Z" />
      <path className={styles.artTrim} d="M49 99h94M49 130h94" />
      <Windows x={57} y={105} columns={4} rows={1} stepX={25} />
      <path className={styles.artDoor} d="M88 118h16v19H88Z" />
      {level >= 2 && <><Block x={31} y={106} width={17} height={31} tone="warm" /><Block x={144} y={106} width={17} height={31} tone="warm" /></>}
      {level >= 3 && <path className={styles.artGold} d="M72 65h49M96 59V40m-8 5h16" />}
    </>}
    {kind === "science_lab" && <>
      <Block x={46} y={level >= 2 ? 76 : 87} width={103} height={level >= 2 ? 66 : 55} tone="glass" />
      <path className={styles.artRoof} d="M42 87 94 63l61 24-10 6-51-19-43 19Z" />
      <Windows x={59} y={100} columns={4} rows={2} stepX={23} stepY={18} />
      <path className={styles.artDoor} d="M91 122h15v20H91Z" />
      <path className={styles.artChimney} d="M119 73V42h18v40" />
      {level >= 2 && <path className={styles.artChimney} d="M70 77V52h14v26" />}
      {level >= 3 && <><circle className={styles.artGold} cx="99" cy="78" r="10" /><path className={styles.artGold} d="M99 64v28m-14-14h28" /></>}
    </>}
    {kind === "language_academy" && <>
      <Block x={49} y={level >= 2 ? 72 : 86} width={94} height={level >= 2 ? 68 : 54} tone="warm" />
      <path className={styles.artRoof} d="M43 83 96 52l53 31-12 6-41-24-41 24Z" />
      <path className={styles.artArch} d="M82 140v-25a14 14 0 0 1 28 0v25" />
      <Windows x={59} y={101} columns={2} rows={1} stepX={68} />
      <path className={styles.artFlag} d="M96 51V30l20 6-20 6" />
      {level >= 2 && <><Block x={34} y={108} width={17} height={32} tone="warm" /><Block x={142} y={108} width={17} height={32} tone="warm" /></>}
      {level >= 3 && <path className={styles.artGold} d="M54 93h85M61 131h19m33 0h21" />}
    </>}
    {kind === "planner_hall" && <>
      <Block x={46} y={level >= 2 ? 85 : 97} width={100} height={level >= 2 ? 54 : 43} tone="stone" />
      <path className={styles.artRoof} d="M40 97 95 65l58 32-11 5-47-24-47 24Z" />
      <circle className={styles.artClock} cx="96" cy="99" r="12" />
      <path className={styles.artClockHands} d="M96 91v8l5 4" />
      <path className={styles.artDoor} d="M87 120h18v21H87Z" />
      <Windows x={55} y={117} columns={2} rows={1} stepX={70} />
      {level >= 2 && <><Block x={30} y={112} width={18} height={28} tone="stone" /><Block x={145} y={112} width={18} height={28} tone="stone" /></>}
      {level >= 3 && <><path className={styles.artGold} d="M96 64V43m-8 4h16" /><circle className={styles.artGoldFill} cx="96" cy="41" r="4" /></>}
    </>}
    {level === 0 && <><path className={styles.artScaffold} d="M32 142V85m0 8h20m96-8v57m-18-49h18M32 111h20m76 0h20" /><path className={styles.artScaffold} d="M35 83h14m87 0h14" /></>}
    {level >= 3 && <><circle className={styles.artGoldFill} cx="31" cy="144" r="3" /><circle className={styles.artGoldFill} cx="165" cy="144" r="3" /></>}
  </svg>;
}
