/**
 * Typography motions (타이포그래피 10종). Every draw, duration, and outro is self-contained: it uses only its
 * arguments, so code copy can paste its source as it is.
 */
import { colorParam, rangeParam, selectParam, toggleParam, type MotionPreset } from "../shared/motions.ts";

const progressiveBlur: MotionPreset = {
  id: "typo-progressive-blur",
  kind: "typography",
  name: "프로그레시브 블러",
  summary: "글자가 차례로 흐림 속에서 떠오르며 선명해진다",
  timing: "intro",
  posterAt: 0.55,
  defaults: { font: "pretendard", weight: 200, strongWeight: 800 },
  strength: rangeParam("blur", "시작 블러", 0, 60, 1, 20, "%"),
  params: [
    selectParam("unit", "단위", [["char", "글자"], ["word", "단어"], ["line", "줄"]], "char"),
    rangeParam("stagger", "글자 간격", 5, 200, 0.5, 16.5, "ms"),
    rangeParam("letter", "글자 시간", 300, 3000, 25, 1725, "ms"),
    rangeParam("delay", "시작 지연", 0, 2000, 10, 630, "ms"),
    rangeParam("rise", "떠오름", 0, 60, 1, 10, "%"),
    rangeParam("ink", "잉크", 0.1, 1, 0.05, 0.3),
  ],
  duration: (input, kit) => {
    const v = input.values;
    const steps = input.text ? kit.unitCount(input.text, String(v.unit)) : 1;
    return (kit.num(v, "delay") + Math.max(0, steps - 1) * kit.num(v, "stagger") + kit.num(v, "letter")) / 1000;
  },
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const ms = frame.t * 1000;
    const blur = (kit.num(v, "blur") / 100) * layout.size;
    const rise = (kit.num(v, "rise") / 100) * layout.size;
    ctx.fillStyle = String(v.color);
    ctx.textBaseline = "alphabetic";
    for (const c of layout.chars) {
      const step = kit.unitOf(c, String(v.unit));
      const p = kit.clamp((ms - kit.num(v, "delay") - step * kit.num(v, "stagger")) / kit.num(v, "letter", 1));
      if (p <= 0) continue;
      const b = kit.ease("out3", p);
      const alpha = kit.ease("sine", kit.clamp(p / kit.num(v, "ink", 0.3)));
      ctx.font = kit.font(v, layout.size, c.strong);
      kit.fillBlurred(ctx, frame, c.ch, c.x, c.y + (1 - b) * rise, (1 - b) * blur, alpha);
    }
  },
};

const eyeLens: MotionPreset = {
  id: "typo-eye-lens",
  kind: "typography",
  name: "볼록 렌즈",
  summary: "둥근 렌즈가 문장 위를 지나가며 글자를 볼록하게 부풀린다",
  timing: "cycle",
  posterAt: 0.3,
  defaults: { font: "montserrat", weight: 300, strongWeight: 700 },
  strength: rangeParam("zoom", "배율", 1.1, 3, 0.05, 1.8, "×"),
  params: [
    rangeParam("lens", "렌즈 지름", 10, 80, 1, 30, "%"),
    selectParam("path", "경로", [["ltr", "왼쪽→오른쪽"], ["pingpong", "왕복"], ["circle", "원"], ["eight", "8자"]], "pingpong"),
    rangeParam("soft", "가장자리 부드러움", 0, 100, 1, 40),
    rangeParam("aberration", "색수차", 0, 100, 1, 15),
    selectParam("rim", "테두리", [["none", "없음"], ["line", "선"], ["glass", "유리"]], "glass"),
  ],
  duration: () => 5,
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const base = kit.layer(frame, "lens:text", true);
    kit.drawChars(base, frame, String(v.color));
    const u = frame.t / frame.timeline.period;
    const R = (kit.num(v, "lens", 30) / 100) * 540;
    const box = layout.box;
    const midY = box.y + box.h / 2;
    const turn = Math.PI * 2 * u;
    const path = String(v.path);
    let cx = 540;
    let cy = midY;
    if (path === "ltr") {
      cx = kit.lerp(box.x - R, box.x + box.w + R, u);
    } else if (path === "pingpong") {
      cx = kit.lerp(box.x + R * 0.25, box.x + box.w - R * 0.25, 0.5 - 0.5 * Math.cos(turn));
      cy = midY + Math.sin(turn * 2) * box.h * 0.18;
    } else if (path === "circle") {
      cx = 540 + Math.cos(turn) * Math.max(box.w / 2 - R * 0.3, 60);
      cy = midY + Math.sin(turn) * Math.max(box.h / 2, 60);
    } else {
      cx = 540 + Math.sin(turn) * Math.max(box.w / 2 - R * 0.2, 60);
      cy = midY + Math.sin(turn * 2) * Math.max(box.h / 2, 80);
    }
    kit.lensBlit(ctx, frame, base, cx, cy, R, kit.num(v, "zoom", 1.8), kit.num(v, "soft") / 100, kit.num(v, "aberration") / 100);
    const rim = String(v.rim);
    if (rim === "glass") {
      const glow = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.05, cx, cy, R);
      glow.addColorStop(0, "rgba(255,255,255,0.18)");
      glow.addColorStop(0.55, "rgba(255,255,255,0.03)");
      glow.addColorStop(0.9, "rgba(255,255,255,0.05)");
      glow.addColorStop(1, "rgba(255,255,255,0.24)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.32)";
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.8, Math.PI * 1.08, Math.PI * 1.42);
      ctx.stroke();
    } else if (rim === "line") {
      ctx.lineWidth = 4;
      ctx.strokeStyle = String(v.color);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();
    }
  },
};

const shine: MotionPreset = {
  id: "typo-shine",
  kind: "typography",
  name: "샤이닝",
  summary: "비스듬한 빛줄기가 글자 표면을 쓸고 지나가며 반짝인다",
  timing: "cycle",
  posterAt: 0.36,
  defaults: { font: "pretendard", weight: 200, strongWeight: 800 },
  strength: rangeParam("glow", "빛 밝기", 0, 100, 1, 80),
  params: [
    rangeParam("width", "빛 폭", 2, 60, 1, 16, "%"),
    rangeParam("angle", "각도", -60, 60, 1, 25, "°"),
    colorParam("light", "빛 색", "#FFFFFF"),
    rangeParam("dim", "바탕 글자 밝기", 20, 100, 1, 75, "%"),
    rangeParam("beams", "빛 개수", 1, 3, 1, 1),
    toggleParam("sparkle", "반짝임 점", true),
  ],
  duration: () => 2.8,
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const color = String(v.color);
    ctx.globalAlpha = kit.num(v, "dim", 75) / 100;
    kit.drawChars(ctx, frame, color);
    ctx.globalAlpha = 1;
    const box = layout.box;
    const angle = (kit.num(v, "angle") * Math.PI) / 180;
    const half = Math.max(4, ((kit.num(v, "width", 16) / 100) * box.w) / 2);
    const slant = Math.abs(Math.tan(angle)) * box.h;
    const glow = kit.num(v, "glow", 80) / 100;
    const beams = kit.layer(frame, "shine:beams");
    const count = Math.round(kit.num(v, "beams", 1));
    let lead = -1;
    for (let i = 0; i < count; i += 1) {
      const s = (frame.t / frame.timeline.period - i * 0.16) / 0.62;
      if (i === 0) lead = s;
      if (s <= 0 || s >= 1) continue;
      const x = kit.lerp(box.x - half - slant, box.x + box.w + half + slant, s);
      beams.save();
      beams.translate(x, box.y + box.h / 2);
      beams.rotate(angle);
      const band = beams.createLinearGradient(-half, 0, half, 0);
      band.addColorStop(0, kit.rgba(String(v.light), 0));
      band.addColorStop(0.5, kit.rgba(String(v.light), glow));
      band.addColorStop(1, kit.rgba(String(v.light), 0));
      beams.fillStyle = band;
      beams.fillRect(-half, -1500, half * 2, 3000);
      beams.restore();
    }
    const text = kit.layer(frame, "shine:text");
    kit.drawChars(text, frame, color);
    text.globalCompositeOperation = "source-in";
    text.setTransform(1, 0, 0, 1, 0, 0);
    text.drawImage(beams.canvas, 0, 0);
    kit.blit(ctx, frame, text);
    if (v.sparkle && lead > 0.78 && lead < 1.08) {
      const last = layout.chars[layout.chars.length - 1];
      if (!last) return;
      const k = Math.sin(Math.PI * kit.clamp((lead - 0.78) / 0.3));
      const r = layout.size * 0.34 * k;
      const sx = last.x + last.w * 0.9;
      const sy = last.y - layout.size * 0.72;
      ctx.fillStyle = kit.rgba(String(v.light), glow);
      ctx.beginPath();
      for (let p = 0; p < 8; p += 1) {
        const a = (p * Math.PI) / 4;
        const rr = p % 2 === 0 ? r : r * 0.18;
        ctx.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
    }
  },
};

const dotted: MotionPreset = {
  id: "typo-dotted",
  kind: "typography",
  name: "점선",
  summary: "글자 윤곽이 점선으로 그려지고 점들이 윤곽을 따라 흐른다",
  timing: "cycle",
  posterAt: 0.8,
  defaults: { font: "montserrat", weight: 300, strongWeight: 700 },
  strength: rangeParam("dot", "점 크기", 1, 16, 0.5, 5, "px"),
  params: [
    selectParam("shape", "모양", [["dot", "점"], ["dash", "대시"]], "dot"),
    rangeParam("gap", "간격", 2, 48, 1, 12, "px"),
    rangeParam("flow", "흐름 속도", 0, 200, 1, 60, "px/초"),
    toggleParam("reveal", "그려지기", true),
    selectParam("fill", "채우기", [["none", "없음"], ["after", "그린 뒤 채움"]], "none"),
    rangeParam("fillAlpha", "채움 투명도", 0, 100, 1, 100, "%", { id: "fill", is: "after" }),
  ],
  duration: () => 4,
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const period = frame.timeline.period;
    const t = frame.t;
    const dot = kit.num(v, "dot", 5);
    const gap = kit.num(v, "gap", 12);
    const dash = String(v.shape) === "dash";
    const pattern = dash ? [dot * 2.6, gap] : [0.001, dot + gap];
    const repeat = pattern[0] + pattern[1];
    const turns = Math.round((kit.num(v, "flow", 60) * period) / repeat);
    const offset = (turns * repeat * t) / period;
    const reveal = v.reveal ? kit.ease("inOut3", kit.clamp(t / (period * 0.45))) : 1;
    ctx.lineWidth = dot;
    ctx.lineCap = dash ? "butt" : "round";
    ctx.lineJoin = "round";
    ctx.setLineDash(pattern);
    ctx.lineDashOffset = -offset;
    ctx.strokeStyle = String(v.color);
    ctx.save();
    if (reveal < 1) {
      ctx.beginPath();
      ctx.rect(0, 0, layout.box.x - 30 + (layout.box.w + 60) * reveal, 1080);
      ctx.clip();
    }
    for (const c of layout.chars) {
      ctx.font = kit.font(v, layout.size, c.strong);
      ctx.strokeText(c.ch, c.x, c.y);
    }
    ctx.restore();
    ctx.setLineDash([]);
    if (String(v.fill) === "after") {
      const fill = v.reveal ? kit.ease("out3", kit.clamp((t - period * 0.45) / (period * 0.2))) : 1;
      if (fill > 0) {
        ctx.globalAlpha = (fill * kit.num(v, "fillAlpha", 100)) / 100;
        kit.drawChars(ctx, frame, String(v.color));
        ctx.globalAlpha = 1;
      }
    }
  },
};

const typewriter: MotionPreset = {
  id: "typo-typewriter",
  kind: "typography",
  name: "타자기",
  summary: "글자가 하나씩 찍히고 커서가 깜빡인다",
  timing: "intro",
  posterAt: 0.6,
  defaults: { font: "roboto", weight: 300, strongWeight: 700 },
  strength: rangeParam("jitter", "타이핑 리듬 흔들림", 0, 100, 1, 30),
  params: [
    rangeParam("perChar", "글자당 시간", 20, 300, 5, 65, "ms"),
    selectParam("caret", "커서", [["bar", "막대"], ["underline", "밑줄"], ["block", "블록"], ["none", "없음"]], "bar"),
    rangeParam("blink", "깜빡임 주기", 0.3, 2, 0.05, 0.9, "초"),
    toggleParam("erase", "지우고 다시 쓰기", false),
  ],
  duration: (input, kit) => kit.typeTimes(input.text, input.values).total + 0.15,
  outro: (input, kit) => (input.values.erase && input.text ? (input.text.chars.length * kit.num(input.values, "perChar", 65) * 0.45) / 1000 + 0.3 : 0),
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const tl = frame.timeline;
    const times = kit.typeTimes(layout, v).at;
    let shown = 0;
    if (frame.t <= tl.intro) {
      for (const at of times) if (at <= frame.t) shown += 1;
    } else {
      const per = (kit.num(v, "perChar", 65) * 0.45) / 1000;
      shown = Math.max(0, layout.chars.length - Math.floor((frame.t - tl.intro) / per));
    }
    ctx.fillStyle = String(v.color);
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < shown; i += 1) {
      const c = layout.chars[i];
      if (!c) continue;
      ctx.font = kit.font(v, layout.size, c.strong);
      ctx.fillText(c.ch, c.x, c.y);
    }
    const caret = String(v.caret);
    if (caret === "none") return;
    const typing = frame.t > 0 && frame.t < tl.intro + tl.outro && frame.t !== tl.intro;
    const blink = kit.num(v, "blink", 0.9);
    if (!typing && frame.clock % blink > blink / 2) return;
    const size = layout.size;
    const prev = layout.chars[shown - 1];
    const first = layout.chars[0];
    const x = prev ? prev.x + prev.w + size * 0.05 : first ? first.x : 540;
    const y = prev ? prev.y : first ? first.y : 540;
    ctx.fillStyle = String(v.color);
    if (caret === "bar") ctx.fillRect(x, y - size * 0.8, Math.max(2, size * 0.06), size * 0.98);
    else if (caret === "underline") ctx.fillRect(x, y + size * 0.08, size * 0.5, Math.max(2, size * 0.07));
    else {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(x, y - size * 0.8, size * 0.55, size * 0.98);
      ctx.globalAlpha = 1;
    }
  },
};

const scramble: MotionPreset = {
  id: "typo-scramble",
  kind: "typography",
  name: "스크램블",
  summary: "무작위 문자가 섞이다가 제자리 글자로 풀린다",
  timing: "intro",
  posterAt: 0.45,
  defaults: { font: "montserrat", weight: 300, strongWeight: 700 },
  strength: rangeParam("scramble", "글자당 섞이는 시간", 100, 1500, 10, 500, "ms"),
  params: [
    selectParam("charset", "문자 집합", [["alnum", "영문+숫자"], ["upper", "영문 대문자"], ["symbols", "기호"], ["blocks", "블록 ▓▒░"]], "alnum"),
    selectParam("order", "풀리는 순서", [["ltr", "왼쪽부터"], ["random", "무작위"], ["center", "가운데부터"]], "ltr"),
    rangeParam("rate", "바뀌는 빈도", 5, 60, 1, 24, "회/초"),
    rangeParam("seed", "씨앗", 1, 999, 1, 7),
  ],
  duration: (input, kit) => ((Math.max(1, input.text ? input.text.chars.length : 1) - 1) * 40 + kit.num(input.values, "scramble", 500)) / 1000 + 0.05,
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const sets: Record<string, string> = {
      alnum: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      symbols: "!<>-_/\\[]{}=+*^?#%&@$",
      blocks: "▓▒░█▚▞▖▝",
    };
    const set = Array.from(sets[String(v.charset)] ?? sets.alnum);
    const seed = kit.num(v, "seed", 7);
    const order = String(v.order);
    const rank = layout.chars.map((c, i) => (order === "random" ? kit.hash(i, seed, 1) : order === "center" ? Math.abs(c.x + c.w / 2 - 540) : i));
    const position = new Array<number>(layout.chars.length);
    rank
      .map((r, i) => [r, i])
      .sort((a, b) => a[0] - b[0] || a[1] - b[1])
      .forEach(([, i], at) => {
        position[i] = at;
      });
    const ms = frame.t * 1000;
    const span = kit.num(v, "scramble", 500);
    const tick = Math.floor(frame.t * kit.num(v, "rate", 24));
    ctx.fillStyle = String(v.color);
    ctx.textBaseline = "alphabetic";
    layout.chars.forEach((c, i) => {
      const start = position[i] * 40;
      if (ms < start) return;
      ctx.font = kit.font(v, layout.size, c.strong);
      if (ms >= start + span) {
        ctx.textAlign = "left";
        ctx.fillText(c.ch, c.x, c.y);
        return;
      }
      const glyph = set[Math.floor(kit.hash(i, tick, seed) * set.length)] ?? c.ch;
      ctx.globalAlpha = 0.85;
      ctx.textAlign = "center";
      ctx.fillText(glyph, c.x + c.w / 2, c.y);
      ctx.globalAlpha = 1;
    });
    ctx.textAlign = "left";
  },
};

const wave: MotionPreset = {
  id: "typo-wave",
  kind: "typography",
  name: "웨이브",
  summary: "글자들이 물결처럼 오르내린다",
  timing: "cycle",
  posterAt: 0.62,
  defaults: { font: "pretendard", weight: 200, strongWeight: 800 },
  strength: rangeParam("amp", "진폭", 0, 160, 1, 40, "px"),
  params: [
    rangeParam("wavelength", "파장", 2, 30, 1, 9, "글자"),
    rangeParam("period", "주기", 0.5, 6, 0.1, 2.4, "초"),
    rangeParam("tilt", "흔들림 회전", 0, 30, 1, 6, "°"),
    rangeParam("pulse", "크기 펄스", 0, 40, 1, 0, "%"),
    toggleParam("appear", "물결 따라 나타나기", true),
  ],
  duration: (input, kit) => {
    const period = kit.num(input.values, "period", 2.4);
    return period * Math.max(1, Math.ceil(3 / period));
  },
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const period = kit.num(v, "period", 2.4);
    const amp = kit.num(v, "amp", 40);
    const length = kit.num(v, "wavelength", 9);
    const tilt = (kit.num(v, "tilt", 6) * Math.PI) / 180;
    const pulse = kit.num(v, "pulse") / 100;
    const total = frame.timeline.period;
    ctx.fillStyle = String(v.color);
    ctx.textBaseline = "alphabetic";
    for (const c of layout.chars) {
      const phase = Math.PI * 2 * (frame.t / period - c.k / length);
      let alpha = 1;
      let lift = 0;
      if (v.appear) {
        const start = (c.k / Math.max(1, layout.steps)) * total * 0.3;
        alpha = kit.clamp((frame.t - start) / 0.3);
        lift = (1 - kit.ease("out3", alpha)) * amp;
      }
      if (alpha <= 0) continue;
      const scale = 1 + pulse * Math.sin(phase);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x + c.w / 2, c.y - amp * Math.sin(phase) + lift);
      ctx.rotate(tilt * Math.cos(phase));
      ctx.scale(scale, scale);
      ctx.font = kit.font(v, layout.size, c.strong);
      ctx.fillText(c.ch, -c.w / 2, 0);
      ctx.restore();
    }
  },
};

const maskRise: MotionPreset = {
  id: "typo-mask-rise",
  kind: "typography",
  name: "마스크 리빌",
  summary: "단어가 보이지 않는 선 아래에서 차례로 올라온다",
  timing: "intro",
  posterAt: 0.5,
  defaults: { font: "pretendard", weight: 200, strongWeight: 800 },
  strength: rangeParam("distance", "올라오는 거리", 50, 150, 1, 110, "%"),
  params: [
    selectParam("unit", "단위", [["char", "글자"], ["word", "단어"], ["line", "줄"]], "word"),
    rangeParam("stagger", "간격", 20, 400, 5, 90, "ms"),
    selectParam("easing", "이징", [["sine", "부드럽게"], ["outExpo", "빠르게 멈춤"], ["outBack", "튕김"]], "outExpo"),
    rangeParam("skew", "기울기", 0, 20, 0.5, 6, "°"),
    toggleParam("exit", "반복 때 위로 사라짐", true),
  ],
  duration: (input, kit) => {
    const steps = input.text ? kit.unitCount(input.text, String(input.values.unit)) : 1;
    return (Math.max(0, steps - 1) * kit.num(input.values, "stagger", 90)) / 1000 + 0.8;
  },
  outro: (input, kit) => {
    if (!input.values.exit) return 0;
    const steps = input.text ? kit.unitCount(input.text, String(input.values.unit)) : 1;
    return (Math.max(0, steps - 1) * kit.num(input.values, "stagger", 90)) / 1000 + 0.6;
  },
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const unit = String(v.unit);
    const stagger = kit.num(v, "stagger", 90) / 1000;
    const distance = (kit.num(v, "distance", 110) / 100) * layout.lineHeight;
    const skew = (kit.num(v, "skew", 6) * Math.PI) / 180;
    const intro = frame.timeline.intro;
    ctx.fillStyle = String(v.color);
    ctx.textBaseline = "alphabetic";
    layout.lines.forEach((line, lineIndex) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, line.y - layout.size * 1.02, 1080, layout.size * 1.32);
      ctx.clip();
      for (const c of layout.chars) {
        if (c.line !== lineIndex) continue;
        const u = kit.unitOf(c, unit);
        let y = 0;
        let lean = 0;
        if (frame.t <= intro) {
          const p = kit.ease(String(v.easing), (frame.t - u * stagger) / 0.8);
          if (frame.t - u * stagger <= 0) continue;
          y = (1 - p) * distance;
          lean = (1 - kit.clamp(p)) * skew;
        } else {
          const q = kit.ease("in3", (frame.t - intro - u * stagger) / 0.6);
          y = -q * distance;
          lean = q * skew;
        }
        ctx.save();
        ctx.translate(c.x, c.y + y);
        ctx.transform(1, 0, -Math.tan(lean), 1, 0, 0);
        ctx.font = kit.font(v, layout.size, c.strong);
        ctx.fillText(c.ch, 0, 0);
        ctx.restore();
      }
      ctx.restore();
    });
  },
};

const glitch: MotionPreset = {
  id: "typo-glitch",
  kind: "typography",
  name: "글리치",
  summary: "RGB가 갈라지고 가로 조각이 튀는 디지털 노이즈",
  timing: "cycle",
  posterAt: 0.12,
  defaults: { font: "roboto", weight: 300, strongWeight: 700 },
  strength: rangeParam("split", "RGB 분리 거리", 0, 60, 1, 10, "px"),
  params: [
    rangeParam("slices", "조각 수", 0, 24, 1, 6),
    rangeParam("rate", "빈도", 0.5, 12, 0.5, 3, "회/초"),
    rangeParam("length", "한 번 길이", 40, 600, 10, 160, "ms"),
    colorParam("colorA", "색 1", "#00E5FF"),
    colorParam("colorB", "색 2", "#FF105C"),
    toggleParam("scan", "스캔라인", true),
    rangeParam("seed", "씨앗", 1, 999, 1, 7),
  ],
  duration: () => 4,
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const period = frame.timeline.period;
    const seed = kit.num(v, "seed", 7);
    const count = Math.max(1, Math.round(kit.num(v, "rate", 3) * period));
    const length = kit.num(v, "length", 160) / 1000;
    let strength = 0;
    let event = -1;
    for (let i = 0; i < count; i += 1) {
      const start = ((i + kit.hash(i, seed, 3) * 0.6) * period) / count;
      if (frame.t >= start && frame.t < start + length) {
        strength = Math.sin(Math.PI * ((frame.t - start) / length));
        event = i;
      }
    }
    const base = kit.layer(frame, "glitch:base");
    kit.drawChars(base, frame, String(v.color));
    if (strength <= 0.001) {
      kit.blit(ctx, frame, base);
      return;
    }
    const split = kit.num(v, "split", 10) * strength;
    const tint = (key: string, color: string) => {
      const g = kit.layer(frame, key);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.drawImage(base.canvas, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = color;
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      return g;
    };
    kit.blit(ctx, frame, tint("glitch:a", String(v.colorA)), 0.85, -split, split * 0.15);
    kit.blit(ctx, frame, tint("glitch:b", String(v.colorB)), 0.85, split, -split * 0.15);
    const main = kit.layer(frame, "glitch:main");
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.drawImage(base.canvas, 0, 0);
    const s = frame.scale;
    const box = layout.box;
    const slices = Math.round(kit.num(v, "slices", 6));
    for (let j = 0; j < slices; j += 1) {
      const y = (box.y + kit.hash(event, j, seed) * box.h) * s;
      const h = (0.03 + kit.hash(event, j + 50, seed) * 0.1) * box.h * s;
      const dx = (kit.hash(event, j + 100, seed) * 2 - 1) * split * 3 * s;
      main.clearRect(0, y, main.canvas.width, h);
      main.drawImage(base.canvas, 0, y, base.canvas.width, h, dx, y, base.canvas.width, h);
    }
    if (v.scan) {
      main.globalCompositeOperation = "source-atop";
      main.fillStyle = `rgba(0,0,0,${0.28 * strength})`;
      for (let y = 0; y < main.canvas.height; y += Math.max(2, Math.round(6 * s))) main.fillRect(0, y, main.canvas.width, Math.max(1, Math.round(2 * s)));
    }
    kit.blit(ctx, frame, main);
  },
};

const highlight: MotionPreset = {
  id: "typo-highlight",
  kind: "typography",
  name: "하이라이트",
  summary: "형광펜 띠가 강조할 단어 뒤로 그어지고 띠 위 글자색이 바뀐다",
  timing: "intro",
  posterAt: 0.75,
  defaults: { font: "montserrat", weight: 300, strongWeight: 700 },
  strength: rangeParam("height", "띠 높이", 20, 120, 1, 55, "%"),
  params: [
    selectParam("range", "강조 범위", [["last", "마지막 N단어"], ["all", "전부"]], "last"),
    rangeParam("words", "강조 단어 수", 1, 8, 1, 3, "단어", { id: "range", is: "last" }),
    colorParam("band", "띠 색", "#4065F8"),
    selectParam("place", "위치", [["bottom", "아래"], ["middle", "가운데"]], "bottom"),
    rangeParam("tilt", "기울기", -6, 6, 0.5, -2, "°"),
    rangeParam("drawTime", "그리는 시간", 200, 2000, 10, 700, "ms"),
    selectParam("cap", "끝 모양", [["square", "각짐"], ["round", "둥글게"], ["brush", "붓"]], "round"),
    colorParam("onBand", "띠 위 글자색", "#FCFCFF"),
  ],
  duration: (input, kit) => 0.35 + kit.num(input.values, "drawTime", 700) / 1000 + 0.15,
  draw: (ctx, frame, kit) => {
    const layout = frame.text;
    if (!layout) return;
    const v = frame.values;
    const size = layout.size;
    const first = String(v.range) === "all" ? 0 : Math.max(0, layout.words - Math.round(kit.num(v, "words", 3)));
    const segments: { x: number; w: number; y: number }[] = [];
    for (const line of layout.lines) {
      const picked = layout.chars.filter((c) => c.word >= first && Math.abs(c.y - line.y) < 0.5);
      if (!picked.length) continue;
      const left = picked[0].x - size * 0.08;
      const right = picked[picked.length - 1].x + picked[picked.length - 1].w + size * 0.08;
      segments.push({ x: left, w: right - left, y: line.y });
    }
    const total = segments.reduce((sum, seg) => sum + seg.w, 0);
    let drawn = kit.ease("inOut3", (frame.t - 0.35) / (kit.num(v, "drawTime", 700) / 1000)) * total;
    const h = (kit.num(v, "height", 55) / 100) * size * 0.5;
    const place = String(v.place);
    const tilt = (kit.num(v, "tilt", -2) * Math.PI) / 180;
    const cap = String(v.cap);
    const band = (g: CanvasRenderingContext2D, seg: { x: number; w: number; y: number }, width: number, index: number) => {
      const top = place === "middle" ? seg.y - size * 0.32 - h / 2 : seg.y + size * 0.1 - h;
      g.save();
      g.translate(seg.x, top + h / 2);
      g.rotate(tilt);
      g.beginPath();
      if (cap === "brush") {
        const steps = 14;
        for (let i = 0; i <= steps; i += 1) g.lineTo((width * i) / steps, -h / 2 + (kit.hash(index, i, 5) - 0.5) * h * 0.22);
        for (let i = steps; i >= 0; i -= 1) g.lineTo((width * i) / steps, h / 2 + (kit.hash(index, i, 9) - 0.5) * h * 0.22);
        g.closePath();
      } else {
        kit.roundRect(g, 0, -h / 2, width, h, cap === "round" ? h / 2 : 0);
      }
      g.restore();
    };
    const widths = segments.map((seg) => {
      const width = Math.max(0, Math.min(seg.w, drawn));
      drawn -= seg.w;
      return width;
    });
    ctx.fillStyle = String(v.band);
    segments.forEach((seg, index) => {
      if (widths[index] <= 0) return;
      band(ctx, seg, widths[index], index);
      ctx.fill();
    });
    ctx.globalAlpha = kit.ease("out3", frame.t / 0.35);
    kit.drawChars(ctx, frame, String(v.color));
    ctx.globalAlpha = 1;
    segments.forEach((seg, index) => {
      if (widths[index] <= 0) return;
      ctx.save();
      band(ctx, seg, widths[index], index);
      ctx.clip();
      kit.drawChars(ctx, frame, String(v.onBand));
      ctx.restore();
    });
  },
};

export const TYPOGRAPHY_MOTIONS: readonly MotionPreset[] = [progressiveBlur, eyeLens, shine, dotted, typewriter, scramble, wave, maskRise, glitch, highlight];
