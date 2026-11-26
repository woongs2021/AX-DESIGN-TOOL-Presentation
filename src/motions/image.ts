/**
 * Image motions (이미지 10종). Images come from the shared slots, in order. Every draw, duration, and outro is
 * self-contained: it uses only its arguments, so code copy can paste its source as it is.
 */
import { rangeParam, selectParam, toggleParam, type MotionPreset } from "../shared/motions.ts";

const progressiveBlur: MotionPreset = {
  id: "img-progressive-blur",
  kind: "image",
  name: "프로그레시브 블러 리빌",
  summary: "흐린 이미지 위로 선명한 영역이 그라데이션으로 번져 나온다",
  timing: "intro",
  posterAt: 0.45,
  strength: rangeParam("blur", "최대 블러", 0, 80, 1, 36, "px"),
  params: [
    selectParam("direction", "방향", [["down", "위→아래"], ["up", "아래→위"], ["right", "왼→오"], ["center", "가운데에서"]], "down"),
    rangeParam("spread", "번짐 폭", 5, 80, 1, 35, "%"),
    rangeParam("rise", "떠오름", 0, 80, 1, 20, "px"),
    toggleParam("fade", "투명도도 함께", true),
  ],
  defaults: { imageSize: 78, ratio: "original" },
  slots: 1,
  duration: () => 2.4,
  draw: (ctx, frame, kit) => {
    const img = frame.images[0];
    if (!img) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, img);
    const e = kit.ease("out3", frame.t / 2.4);
    const x = 540 - w / 2;
    const y = 540 - h / 2 + (1 - e) * kit.num(v, "rise", 20);
    const tex = kit.texture(frame, "pblur:img", img, w, h);
    const sharp = kit.layer(frame, "pblur:sharp");
    kit.drawCard(sharp, frame, tex, x, y, w, h);
    const soft = kit.layer(frame, "pblur:soft");
    soft.setTransform(1, 0, 0, 1, 0, 0);
    if (kit.canFilter(soft)) soft.filter = `blur(${kit.num(v, "blur", 36) * (1 - e * 0.5) * frame.scale}px)`;
    soft.drawImage(sharp.canvas, 0, 0);
    soft.filter = "none";
    const spread = kit.num(v, "spread", 35) / 100;
    const front = kit.lerp(-spread, 1, e);
    const direction = String(v.direction);
    const mask =
      direction === "center"
        ? sharp.createRadialGradient(540, y + h / 2, 0, 540, y + h / 2, Math.hypot(w, h) / 2)
        : direction === "right"
          ? sharp.createLinearGradient(x, 0, x + w, 0)
          : direction === "up"
            ? sharp.createLinearGradient(0, y + h, 0, y)
            : sharp.createLinearGradient(0, y, 0, y + h);
    for (let i = 0; i <= 12; i += 1) mask.addColorStop(i / 12, `rgba(0,0,0,${1 - kit.smooth(front, front + spread, i / 12)})`);
    sharp.globalCompositeOperation = "destination-in";
    sharp.fillStyle = mask;
    sharp.fillRect(0, 0, 1080, 1080);
    const fade = v.fade !== false;
    kit.blit(ctx, frame, soft, (fade ? kit.clamp(e * 3) : 1) * (1 - kit.ease("in3", e)));
    kit.blit(ctx, frame, sharp, fade ? kit.clamp(e * 2.5) : 1);
  },
};

const cardStack: MotionPreset = {
  id: "img-card-stack",
  kind: "image",
  name: "카드 스택",
  summary: "겹친 카드 묶음에서 맨 위 카드가 밀려나 맨 아래로 들어간다",
  timing: "cycle",
  posterAt: 0.12,
  strength: rangeParam("scatter", "흩어짐 회전", 0, 20, 0.5, 6, "°"),
  params: [
    rangeParam("count", "장수", 2, 8, 1, 4),
    rangeParam("offset", "겹침 간격", 0, 80, 1, 22, "px"),
    selectParam("direction", "넘기는 방향", [["up", "위"], ["right", "오른쪽"], ["left", "왼쪽"]], "right"),
    rangeParam("step", "한 장 시간", 0.4, 3, 0.05, 1.2, "초"),
    rangeParam("depth", "깊이 축소", 0, 30, 1, 8, "%"),
  ],
  defaults: { imageSize: 60, ratio: "3:4" },
  slots: "count",
  duration: (input, kit) => input.count * (kit.num(input.values, "step", 1.2) + 0.8),
  draw: (ctx, frame, kit) => {
    const n = frame.images.length;
    if (!n) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, frame.images[0]);
    const step = kit.num(v, "step", 1.2);
    const period = step + 0.8;
    const s = Math.floor(frame.t / period);
    const e = kit.ease("inOut3", (frame.t - s * period) / step);
    const direction = String(v.direction);
    const sideX = direction === "right" ? 1 : direction === "left" ? -1 : 0;
    const sideY = direction === "up" ? -1 : 0;
    const offset = kit.num(v, "offset", 22);
    const depth = kit.num(v, "depth", 8) / 100;
    const scatter = kit.num(v, "scatter", 6);
    const centerY = 540 + ((n - 1) * offset) / 2;
    const cards = [];
    for (let d = 0; d < n; d += 1) {
      const index = (s + d) % n;
      const moving = d === 0;
      const arc = moving ? Math.sin(Math.PI * e) : 0;
      const level = moving ? e * (n - 1) : d - e;
      cards.push({
        index,
        order: moving ? (e < 0.5 ? -1 : n) : level,
        x: sideX * w * 0.95 * arc,
        y: -level * offset + sideY * h * 0.8 * arc,
        rot: (kit.hash(index, 11) * 2 - 1) * scatter + (sideX || 1) * 16 * arc,
        scale: 1 - level * depth,
      });
    }
    cards.sort((a, b) => b.order - a.order);
    for (const card of cards) {
      ctx.save();
      ctx.translate(540 + card.x, centerY + card.y);
      ctx.rotate((card.rot * Math.PI) / 180);
      ctx.scale(card.scale, card.scale);
      kit.drawCard(ctx, frame, kit.texture(frame, `stack:${card.index}`, frame.images[card.index], w, h), -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  },
};

const cardFan: MotionPreset = {
  id: "img-card-fan",
  kind: "image",
  name: "카드 팬",
  summary: "겹친 카드가 손에 쥔 카드처럼 부채꼴로 펼쳐졌다 접힌다",
  timing: "intro",
  posterAt: 0.6,
  strength: rangeParam("angle", "펼침 각도", 10, 150, 1, 70, "°"),
  params: [
    rangeParam("count", "장수", 3, 8, 1, 5),
    rangeParam("pivot", "축 거리", 0, 200, 1, 120, "%"),
    toggleParam("sequential", "차례로 펼치기", true),
    rangeParam("lift", "가운데 들어 올림", 0, 60, 1, 24, "px"),
    toggleParam("fold", "반복 때 접기", true),
  ],
  defaults: { imageSize: 46, ratio: "3:4" },
  slots: "count",
  duration: (input) => 1.2 + (input.values.sequential ? (input.count - 1) * 0.08 : 0),
  outro: (input) => (input.values.fold ? 1 + (input.values.sequential ? (input.count - 1) * 0.06 : 0) : 0),
  draw: (ctx, frame, kit) => {
    const n = frame.images.length;
    if (!n) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, frame.images[0]);
    const spread = kit.num(v, "angle", 70);
    const pivot = (kit.num(v, "pivot", 120) / 100) * h;
    const lift = kit.num(v, "lift", 24);
    const sequential = !!v.sequential;
    const intro = frame.timeline.intro;
    const baseY = 540 + h * 0.18;
    for (let i = 0; i < n; i += 1) {
      const target = n > 1 ? -spread / 2 + (i * spread) / (n - 1) : 0;
      const p =
        frame.t <= intro
          ? kit.ease("out3", (frame.t - (sequential ? i * 0.08 : 0)) / 1.2)
          : 1 - kit.ease("inOut3", (frame.t - intro - (sequential ? (n - 1 - i) * 0.06 : 0)) / 1);
      const up = lift * (1 - Math.abs(target) / Math.max(1, spread / 2)) * p;
      ctx.save();
      ctx.translate(540, baseY + pivot);
      ctx.rotate((target * p * Math.PI) / 180);
      ctx.translate(0, -pivot - up);
      kit.drawCard(ctx, frame, kit.texture(frame, `fan:${i}`, frame.images[i], w, h), -w / 2, -h / 2, w, h);
      ctx.restore();
    }
  },
};

const cardFlip: MotionPreset = {
  id: "img-card-flip",
  kind: "image",
  name: "카드 플립",
  summary: "카드가 3D로 뒤집히며 다음 이미지가 나온다",
  timing: "cycle",
  posterAt: 0.26,
  strength: rangeParam("persp", "원근", 0, 100, 1, 55),
  params: [
    selectParam("axis", "축", [["y", "세로"], ["x", "가로"]], "y"),
    rangeParam("count", "장수", 2, 8, 1, 3),
    rangeParam("flip", "뒤집는 시간", 0.3, 2.5, 0.05, 0.9, "초"),
    selectParam("easing", "이징", [["inOut3", "부드럽게"], ["outBack", "튕김"]], "inOut3"),
  ],
  defaults: { imageSize: 62, ratio: "3:4" },
  slots: "count",
  duration: (input, kit) => input.count * (kit.num(input.values, "flip", 0.9) + 1.3),
  draw: (ctx, frame, kit) => {
    const n = frame.images.length;
    if (!n) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, frame.images[0]);
    const flip = kit.num(v, "flip", 0.9);
    const step = flip + 1.3;
    const s = Math.floor(frame.t / step);
    const angle = Math.PI * kit.ease(String(v.easing), (frame.t - s * step - 1.3) / flip);
    const front = kit.texture(frame, "flip:front", frame.images[s % n], w, h);
    const back = kit.texture(frame, "flip:back", frame.images[(s + 1) % n], w, h);
    const vertical = String(v.axis) !== "x";
    kit.floorShadow(ctx, frame, 540, 540 + h / 2 + 28, vertical ? w * Math.max(0.12, Math.abs(Math.cos(angle))) : w, vertical ? 1 : Math.max(0.2, Math.abs(Math.cos(angle))));
    kit.project(ctx, frame, front, 540, 540, w, h, angle, kit.num(v, "persp", 55), vertical ? "y" : "x", back);
  },
};

const spin360: MotionPreset = {
  id: "img-spin-360",
  kind: "image",
  name: "360° 회전",
  summary: "이미지가 한 축을 중심으로 한 바퀴 돈다",
  timing: "cycle",
  posterAt: 0.1,
  strength: rangeParam("persp", "원근", 0, 100, 1, 45),
  params: [
    selectParam("axis", "축", [["y", "세로"], ["x", "가로"], ["diagonal", "대각"]], "y"),
    rangeParam("turn", "한 바퀴", 1, 12, 0.1, 4, "초"),
    selectParam("back", "뒷면", [["mirror", "거울"], ["next", "다음 이미지"], ["solid", "단색"]], "next"),
    rangeParam("tilt", "기울임", 0, 30, 0.5, 8, "°"),
    toggleParam("reflection", "바닥 반사", false),
  ],
  defaults: { imageSize: 58, ratio: "original" },
  slots: 2,
  duration: (input, kit) => kit.num(input.values, "turn", 4),
  draw: (ctx, frame, kit) => {
    const img = frame.images[0];
    if (!img) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, img);
    const angle = (Math.PI * 2 * frame.t) / frame.timeline.period;
    const front = kit.texture(frame, "spin:front", img, w, h);
    const mode = String(v.back);
    let back: HTMLCanvasElement | null = null;
    if (mode === "next") back = kit.texture(frame, "spin:back", frame.images[1] ?? img, w, h);
    else if (mode === "solid") {
      const solid = kit.canvas(frame, "spin:solid", front.width, front.height);
      kit.roundRect(solid, 0, 0, front.width, front.height, kit.num(v, "radius", 24) * frame.scale);
      solid.fillStyle = "#16427C";
      solid.fill();
      back = solid.canvas;
    }
    const axis = String(v.axis);
    const centerY = v.reflection ? 500 : 540;
    const turn = ((kit.num(v, "tilt", 8) + (axis === "diagonal" ? 45 : 0)) * Math.PI) / 180;
    const paint = (g: CanvasRenderingContext2D) => {
      g.save();
      g.translate(540, centerY);
      g.rotate(turn);
      g.translate(-540, -centerY);
      kit.project(g, frame, front, 540, centerY, w, h, angle, kit.num(v, "persp", 45), axis === "x" ? "x" : "y", back);
      g.restore();
    };
    const floor = centerY + h / 2 + 24;
    kit.floorShadow(ctx, frame, 540, floor, axis === "x" ? w : w * Math.max(0.15, Math.abs(Math.cos(angle))));
    if (!v.reflection) {
      paint(ctx);
      return;
    }
    const main = kit.layer(frame, "spin:main");
    paint(main);
    kit.blit(ctx, frame, main);
    const mirror = kit.layer(frame, "spin:mirror");
    mirror.setTransform(1, 0, 0, 1, 0, 0);
    mirror.translate(0, (centerY + h / 2 + 6) * 2 * frame.scale);
    mirror.scale(1, -1);
    mirror.drawImage(main.canvas, 0, 0);
    mirror.setTransform(frame.scale, 0, 0, frame.scale, 0, 0);
    const fade = mirror.createLinearGradient(0, centerY + h / 2, 0, centerY + h);
    fade.addColorStop(0, "rgba(0,0,0,0.3)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    mirror.globalCompositeOperation = "destination-in";
    mirror.fillStyle = fade;
    mirror.fillRect(0, 0, 1080, 1080);
    kit.blit(ctx, frame, mirror);
  },
};

const carousel: MotionPreset = {
  id: "img-carousel",
  kind: "image",
  name: "3D 캐러셀",
  summary: "카드들이 원형 고리를 이루어 돈다",
  timing: "cycle",
  posterAt: 0.05,
  strength: rangeParam("darken", "뒤쪽 어둡게", 0, 100, 1, 55),
  params: [
    rangeParam("count", "장수", 3, 8, 1, 6),
    rangeParam("ring", "고리 반지름", 20, 60, 1, 38, "%"),
    rangeParam("camera", "카메라 높이", -30, 30, 0.5, 12, "°"),
    selectParam("direction", "방향", [["left", "왼쪽"], ["right", "오른쪽"]], "left"),
    rangeParam("turn", "한 바퀴", 3, 20, 0.5, 9, "초"),
    toggleParam("pause", "앞에서 잠깐 멈춤", true),
  ],
  defaults: { imageSize: 30, ratio: "3:4" },
  slots: "count",
  duration: (input, kit) => kit.num(input.values, "turn", 9),
  draw: (ctx, frame, kit) => {
    const n = frame.images.length;
    if (!n) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, frame.images[0]);
    const turn = frame.timeline.period;
    const ring = (kit.num(v, "ring", 38) / 100) * 1080;
    let phase = frame.t / turn;
    if (v.pause) {
      const stepTime = turn / n;
      const s = Math.floor(frame.t / stepTime);
      phase = (s + kit.ease("inOut3", (frame.t - s * stepTime) / (stepTime * 0.6))) / n;
    }
    const direction = String(v.direction) === "right" ? 1 : -1;
    const camera = (kit.num(v, "camera", 12) * Math.PI) / 180;
    const distance = 1080 * 2.2;
    const items = frame.images
      .map((img, i) => {
        const a = direction * phase * Math.PI * 2 + (i * Math.PI * 2) / n;
        const z = ring * Math.cos(a);
        return { img, i, a, x: ring * Math.sin(a), z, f: distance / (distance - z) };
      })
      .sort((p, q) => p.z - q.z);
    const darken = kit.num(v, "darken", 55) / 100;
    for (const item of items) {
      const sx = 540 + item.x * item.f;
      const sy = 540 + item.z * Math.sin(camera) * 0.5;
      kit.floorShadow(ctx, frame, sx, sy + (h * item.f) / 2 + 16, w * item.f * Math.max(0.2, Math.abs(Math.cos(item.a))), 0.8);
      const shade = darken * (1 - (item.z + ring) / (2 * ring));
      kit.project(ctx, frame, kit.texture(frame, `carousel:${item.i}`, item.img, w, h), sx, sy, w * item.f, h * item.f, item.a, 30, "y", null, shade);
    }
  },
};

const kenBurns: MotionPreset = {
  id: "img-ken-burns",
  kind: "image",
  name: "켄 번즈",
  summary: "천천히 확대되며 흘러가고, 여러 장이면 겹쳐 바뀐다",
  timing: "cycle",
  posterAt: 0.4,
  strength: rangeParam("zoomEnd", "끝 확대", 1, 1.8, 0.01, 1.25, "×"),
  params: [
    rangeParam("zoomStart", "시작 확대", 1, 1.5, 0.01, 1.05, "×"),
    selectParam(
      "direction",
      "이동 방향",
      [["random", "무작위"], ["n", "위"], ["ne", "오른쪽 위"], ["e", "오른쪽"], ["se", "오른쪽 아래"], ["s", "아래"], ["sw", "왼쪽 아래"], ["w", "왼쪽"], ["nw", "왼쪽 위"]],
      "random",
    ),
    rangeParam("distance", "이동 거리", 0, 20, 0.5, 6, "%"),
    rangeParam("count", "장수", 1, 8, 1, 3),
    selectParam("transition", "전환", [["fade", "크로스페이드"], ["cut", "바로"]], "fade"),
    rangeParam("fadeTime", "전환 시간", 0.2, 2, 0.05, 0.8, "초", { id: "transition", is: "fade" }),
  ],
  defaults: { imageSize: 86, ratio: "1:1" },
  slots: "count",
  duration: (input) => input.count * 3.6,
  draw: (ctx, frame, kit) => {
    const n = frame.images.length;
    if (!n) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, frame.images[0]);
    const shot = 3.6;
    const fade = String(v.transition) === "fade" ? Math.min(kit.num(v, "fadeTime", 0.8), shot * 0.8) : 0;
    const W = w * frame.scale;
    const H = h * frame.scale;
    const card = kit.canvas(frame, "kb:card", W, H);
    kit.roundRect(card, 0, 0, W, H, kit.num(v, "radius", 24) * frame.scale);
    card.clip();
    const angles: Record<string, number> = { e: 0, se: 45, s: 90, sw: 135, w: 180, nw: 225, n: 270, ne: 315 };
    const paint = (i: number, alpha: number) => {
      const img = frame.images[((i % n) + n) % n];
      const u = kit.clamp((frame.t - (i * shot - fade)) / (shot + fade));
      const zoom = kit.lerp(kit.num(v, "zoomStart", 1.05), kit.num(v, "zoomEnd", 1.25), kit.ease("sine", u));
      const direction = String(v.direction);
      const a = direction === "random" ? kit.hash(((i % n) + n) % n, 7) * Math.PI * 2 : ((angles[direction] ?? 0) * Math.PI) / 180;
      const travel = (kit.num(v, "distance", 6) / 100) * W * (u - 0.5) * 2;
      const fit = kit.fitRect(img, W, H, "cover");
      card.save();
      card.globalAlpha = alpha;
      card.translate(W / 2 + Math.cos(a) * travel, H / 2 + Math.sin(a) * travel);
      card.scale(zoom, zoom);
      card.drawImage(img, fit.sx, fit.sy, fit.sw, fit.sh, -W / 2, -H / 2, W, H);
      card.restore();
    };
    const s = Math.floor(frame.t / shot);
    const local = frame.t - s * shot;
    paint(s, 1);
    if (fade > 0 && local > shot - fade) paint(s + 1, kit.ease("sine", (local - (shot - fade)) / fade));
    else if (fade === 0 && local > shot - 0.0001) paint(s + 1, 1);
    kit.drawCard(ctx, frame, card.canvas, 540 - w / 2, 540 - h / 2, w, h);
  },
};

const maskWipe: MotionPreset = {
  id: "img-mask-wipe",
  kind: "image",
  name: "마스크 와이프",
  summary: "도형 마스크가 열리며 이미지가 드러나고 다음 이미지로 넘어간다",
  timing: "cycle",
  posterAt: 0.26,
  strength: rangeParam("soft", "가장자리 부드러움", 0, 120, 1, 24, "px"),
  params: [
    selectParam("shape", "모양", [["circle", "원"], ["diagonal", "사선"], ["horizontal", "가로"], ["blinds", "블라인드"], ["diamond", "다이아몬드"]], "circle"),
    selectParam("origin", "시작점", [["center", "가운데"], ["tl", "왼쪽 위"], ["br", "오른쪽 아래"], ["random", "무작위"]], "center"),
    rangeParam("blinds", "블라인드 칸 수", 2, 16, 1, 6, undefined, { id: "shape", is: "blinds" }),
    rangeParam("count", "장수", 1, 8, 1, 3),
    rangeParam("open", "여는 시간", 0.3, 3, 0.05, 1.1, "초"),
  ],
  defaults: { imageSize: 80, ratio: "1:1" },
  slots: "count",
  duration: (input, kit) => input.count * (kit.num(input.values, "open", 1.1) + 1.4),
  draw: (ctx, frame, kit) => {
    const n = frame.images.length;
    if (!n) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, frame.images[0]);
    const open = kit.num(v, "open", 1.1);
    const step = open + 1.4;
    const s = Math.floor(frame.t / step);
    const e = kit.ease("inOut3", (frame.t - s * step - 1.4) / open);
    const W = w * frame.scale;
    const H = h * frame.scale;
    const radius = kit.num(v, "radius", 24) * frame.scale;
    const draw = (g: CanvasRenderingContext2D, img: CanvasImageSource) => {
      const fit = kit.fitRect(img, W, H, String(v.fit));
      g.save();
      kit.roundRect(g, fit.dx, fit.dy, fit.dw, fit.dh, radius);
      g.clip();
      g.drawImage(img, fit.sx, fit.sy, fit.sw, fit.sh, fit.dx, fit.dy, fit.dw, fit.dh);
      g.restore();
    };
    const card = kit.canvas(frame, "wipe:card", W, H);
    if (n > 1) draw(card, frame.images[s % n]);
    if (e > 0) {
      const mask = kit.canvas(frame, "wipe:mask", W, H);
      draw(mask, frame.images[(s + 1) % n]);
      mask.globalCompositeOperation = "destination-in";
      const soft = Math.max(1, kit.num(v, "soft", 24) * frame.scale);
      const origin = String(v.origin);
      const ox = origin === "tl" ? 0 : origin === "br" ? W : origin === "random" ? kit.hash(s, 3) * W : W / 2;
      const oy = origin === "tl" ? 0 : origin === "br" ? H : origin === "random" ? kit.hash(s, 4) * H : H / 2;
      const ramp = (gradient: CanvasGradient, edge: number, width: number) => {
        for (let i = 0; i <= 16; i += 1) gradient.addColorStop(i / 16, `rgba(0,0,0,${1 - kit.smooth(edge - width, edge, i / 16)})`);
      };
      const shape = String(v.shape);
      if (shape === "circle" || shape === "diamond") {
        const reach = Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy));
        if (shape === "circle") {
          const r = e * (reach + soft);
          const gradient = mask.createRadialGradient(ox, oy, 0, ox, oy, Math.max(1, r));
          ramp(gradient, 1, Math.min(1, soft / Math.max(1, r)));
          mask.fillStyle = gradient;
          mask.fillRect(0, 0, W, H);
        } else {
          const r = e * (reach * 1.45 + soft);
          if (kit.canFilter(mask)) mask.filter = `blur(${soft / 2}px)`;
          mask.fillStyle = "#000";
          mask.beginPath();
          mask.moveTo(ox, oy - r);
          mask.lineTo(ox + r, oy);
          mask.lineTo(ox, oy + r);
          mask.lineTo(ox - r, oy);
          mask.closePath();
          mask.fill();
          mask.filter = "none";
        }
      } else if (shape === "blinds") {
        const count = Math.round(kit.num(v, "blinds", 6));
        const band = W / count;
        for (let j = 0; j < count; j += 1) {
          const gradient = mask.createLinearGradient(j * band, 0, (j + 1) * band, 0);
          ramp(gradient, e * (1 + soft / band), soft / band);
          mask.fillStyle = gradient;
          mask.fillRect(j * band, 0, band + 1, H);
        }
      } else {
        const fromEnd = origin === "br";
        const across = shape === "diagonal" ? [fromEnd ? W : 0, fromEnd ? H : 0, fromEnd ? 0 : W, fromEnd ? 0 : H] : [fromEnd ? W : 0, 0, fromEnd ? 0 : W, 0];
        const length = shape === "diagonal" ? W + H : W;
        const gradient = mask.createLinearGradient(across[0], across[1], across[2], across[3]);
        ramp(gradient, e * (1 + soft / length), soft / length);
        mask.fillStyle = gradient;
        mask.fillRect(0, 0, W, H);
      }
      card.drawImage(mask.canvas, 0, 0);
    }
    kit.drawCard(ctx, frame, card.canvas, 540 - w / 2, 540 - h / 2, w, h);
  },
};

const slices: MotionPreset = {
  id: "img-slices",
  kind: "image",
  name: "슬라이스",
  summary: "이미지가 띠로 나뉘어 엇갈려 들어와 한 장이 된다",
  timing: "intro",
  posterAt: 0.5,
  strength: rangeParam("distance", "이동 거리", 0, 100, 1, 60, "%"),
  params: [
    rangeParam("pieces", "조각 수", 3, 24, 1, 9),
    selectParam("direction", "방향", [["vertical", "세로 띠"], ["horizontal", "가로 띠"]], "vertical"),
    selectParam("from", "들어오는 쪽", [["top", "위"], ["bottom", "아래"], ["alternate", "번갈아"]], "alternate"),
    rangeParam("stagger", "엇갈림", 0, 300, 5, 60, "ms"),
    rangeParam("gap", "틈", 0, 20, 0.5, 0, "px"),
    toggleParam("exit", "반복 때 흩어지며 나감", true),
  ],
  defaults: { imageSize: 74, ratio: "original" },
  slots: 1,
  duration: (input, kit) => 0.9 + ((Math.round(kit.num(input.values, "pieces", 9)) - 1) * kit.num(input.values, "stagger", 60)) / 1000,
  outro: (input, kit) => (input.values.exit ? 0.7 + ((Math.round(kit.num(input.values, "pieces", 9)) - 1) * kit.num(input.values, "stagger", 60)) / 1000 : 0),
  draw: (ctx, frame, kit) => {
    const img = frame.images[0];
    if (!img) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, img);
    const tex = kit.texture(frame, "slices:img", img, w, h);
    const x0 = 540 - w / 2;
    const y0 = 540 - h / 2;
    const pieces = Math.round(kit.num(v, "pieces", 9));
    const vertical = String(v.direction) !== "horizontal";
    const stagger = kit.num(v, "stagger", 60) / 1000;
    const travel = (kit.num(v, "distance", 60) / 100) * 1080 * 0.6;
    const gap = kit.num(v, "gap");
    const from = String(v.from);
    const intro = frame.timeline.intro;
    const progress: number[] = [];
    for (let j = 0; j < pieces; j += 1) {
      progress.push(frame.t <= intro ? kit.ease("out3", (frame.t - j * stagger) / 0.9) : 1 - kit.ease("in3", (frame.t - intro - j * stagger) / 0.7));
    }
    const settled = Math.min(...progress);
    const s = kit.num(v, "shadow", 30) / 100;
    if (settled > 0 && s > 0) {
      ctx.save();
      ctx.globalAlpha = settled;
      ctx.shadowColor = `rgba(0,0,0,${0.2 + 0.4 * s})`;
      ctx.shadowBlur = (8 + 64 * s) * frame.scale;
      ctx.shadowOffsetX = 20000 * frame.scale;
      ctx.shadowOffsetY = (4 + 26 * s) * frame.scale;
      ctx.drawImage(tex, x0 - 20000, y0, w, h);
      ctx.restore();
    }
    for (let j = 0; j < pieces; j += 1) {
      const p = progress[j];
      if (p <= 0) continue;
      const sign = from === "top" ? -1 : from === "bottom" ? 1 : j % 2 ? 1 : -1;
      const shift = (1 - p) * travel * sign;
      ctx.globalAlpha = p;
      if (vertical) {
        const band = w / pieces;
        const source = tex.width / pieces;
        ctx.drawImage(tex, j * source, 0, source, tex.height, x0 + j * band + gap / 2, y0 + shift, band - gap, h);
      } else {
        const band = h / pieces;
        const source = tex.height / pieces;
        ctx.drawImage(tex, 0, j * source, tex.width, source, x0 + shift, y0 + j * band + gap / 2, w, band - gap);
      }
    }
    ctx.globalAlpha = 1;
  },
};

const marquee: MotionPreset = {
  id: "img-marquee",
  kind: "image",
  name: "무한 마퀴",
  summary: "카드 띠가 끊김 없이 흘러간다(필름 스트립)",
  timing: "cycle",
  posterAt: 0.3,
  strength: rangeParam("tilt", "띠 기울기", -25, 25, 0.5, -8, "°"),
  params: [
    rangeParam("rows", "줄 수", 1, 3, 1, 2),
    selectParam("direction", "방향", [["left", "왼쪽"], ["right", "오른쪽"], ["alternate", "줄마다 번갈아"]], "alternate"),
    rangeParam("pace", "흐르는 속도", 20, 400, 5, 90, "px/초"),
    rangeParam("gap", "카드 간격", 0, 80, 1, 24, "px"),
    toggleParam("fade", "가장자리 페이드", true),
    rangeParam("count", "장수", 3, 8, 1, 6),
  ],
  defaults: { imageSize: 30, ratio: "3:4" },
  slots: "count",
  duration: (input, kit) => {
    const size = kit.cardSize(input.values, input.images[0]);
    return (Math.max(1, input.count) * (size.w + kit.num(input.values, "gap", 24))) / Math.max(1, kit.num(input.values, "pace", 90));
  },
  draw: (ctx, frame, kit) => {
    const n = frame.images.length;
    if (!n) return;
    const v = frame.values;
    const { w, h } = kit.cardSize(v, frame.images[0]);
    const gap = kit.num(v, "gap", 24);
    const rows = Math.round(kit.num(v, "rows", 2));
    const pitch = w + gap;
    const length = n * pitch;
    const moved = (kit.num(v, "pace", 90) * frame.t) % length;
    const target = v.fade ? kit.layer(frame, "marquee:all") : ctx;
    target.save();
    target.translate(540, 540);
    target.rotate((kit.num(v, "tilt", -8) * Math.PI) / 180);
    target.translate(-540, -540);
    const top = 540 - (rows * (h + gap) - gap) / 2;
    const direction = String(v.direction);
    for (let r = 0; r < rows; r += 1) {
      const sign = direction === "left" ? -1 : direction === "right" ? 1 : r % 2 === 0 ? -1 : 1;
      const start = sign < 0 ? -moved : moved - length;
      for (let i = -2 * n; i < 4 * n; i += 1) {
        const x = start + i * pitch;
        if (x + w < -760 || x > 1840) continue;
        const index = (((i + r * 2) % n) + n) % n;
        kit.drawCard(target, frame, kit.texture(frame, `marquee:${index}`, frame.images[index], w, h), x, top + r * (h + gap), w, h);
      }
    }
    target.restore();
    if (target !== ctx) {
      const edge = target.createLinearGradient(0, 0, 1080, 0);
      edge.addColorStop(0, "rgba(0,0,0,0)");
      edge.addColorStop(0.14, "rgba(0,0,0,1)");
      edge.addColorStop(0.86, "rgba(0,0,0,1)");
      edge.addColorStop(1, "rgba(0,0,0,0)");
      target.globalCompositeOperation = "destination-in";
      target.fillStyle = edge;
      target.fillRect(0, 0, 1080, 1080);
      kit.blit(ctx, frame, target);
    }
  },
};

export const IMAGE_MOTIONS: readonly MotionPreset[] = [progressiveBlur, cardStack, cardFan, cardFlip, spin360, carousel, kenBurns, maskWipe, slices, marquee];
