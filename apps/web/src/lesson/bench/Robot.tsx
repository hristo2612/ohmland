/**
 * The robot in the margin, drawn in ink like the notebook around it. Its eyes are the lesson's progress: dark at the
 * start, filling with amber light beat by beat, fully lit at the sign-off. Moods change the eyes' shape (happy arcs,
 * worried brows). Lesson-scoped for now; the app's shared mascot may adopt it.
 */
export type RobotMood = "idle" | "happy" | "sad" | "thinking";

export function Robot({ lit, mood = "idle", size = 96, label }: { lit: number; mood?: RobotMood; size?: number; label?: string }) {
  const glow = Math.max(0, Math.min(1, lit));
  const eyes = mood === "happy" ? "happy" : mood === "sad" ? "sad" : "dot";
  return (
    <svg
      className={`bl-robot bl-robot--${mood}`}
      data-lit={glow >= 1 ? "full" : glow > 0 ? "some" : "dark"}
      viewBox="0 0 112 152"
      width={size}
      height={(size * 152) / 112}
      style={{ ["--lit" as string]: String(glow) }}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true, focusable: false })}
    >
      <defs>
        <pattern id="bl-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V5" className="bl-robot__hatch" />
        </pattern>
      </defs>
      <ellipse className="bl-robot__shade" cx="58" cy="143" rx="27" ry="4.5" />
      <g className="bl-robot__bob">
        <circle className="bl-robot__antenna-glow" cx="62" cy="10" r="8.5" />
        <path className="bl-robot__line" d="M62 29.5V14.5" />
        <circle className="bl-robot__antenna" cx="62" cy="10" r="4.6" />
        {/* arms */}
        <path className="bl-robot__part" d="M27 95h7v21h-7z" />
        <path className="bl-robot__part" d="M84.5 93.5h7v20h-7z" />
        <path className="bl-robot__hatched" d="M84.5 93.5h7v20h-7z" />
        {/* neck and body */}
        <path className="bl-robot__part" d="M52 84h20v8H52z" />
        <path className="bl-robot__part" d="M78 91l7.5-5.5v35L78 126z" />
        <path className="bl-robot__hatched" d="M78 91l7.5-5.5v35L78 126z" />
        <path className="bl-robot__part" d="M34 91h44v35H34z" />
        <path className="bl-robot__chest" d="M43 98h26v19H43z" />
        {/* head */}
        <path className="bl-robot__part" d="M24 34l12-9h64l-12 9z" />
        <path className="bl-robot__part" d="M88 34l12-9v51l-12 9z" />
        <path className="bl-robot__hatched" d="M88 34l12-9v51l-12 9z" />
        <path className="bl-robot__part" d="M24 34h64v51H24z" />
        <rect className="bl-robot__visor" x="30" y="43" width="52" height="32" rx="3" />
        {/* the eyes: a halo that grows with progress, then the eyes themselves */}
        <circle className="bl-robot__halo" cx="43" cy="59" r="11" />
        <circle className="bl-robot__halo" cx="69" cy="59" r="11" />
        {eyes === "dot" && (
          <g className="bl-robot__eyes">
            <circle cx="43" cy="59" r="4.6" />
            <circle cx="69" cy="59" r="4.6" />
          </g>
        )}
        {eyes === "happy" && (
          <g className="bl-robot__eyes bl-robot__eyes--arcs">
            <path d="M37.5 62q5.5-8 11 0" />
            <path d="M63.5 62q5.5-8 11 0" />
          </g>
        )}
        {eyes === "sad" && (
          <g className="bl-robot__eyes">
            <circle cx="43" cy="63" r="4" />
            <circle cx="69" cy="63" r="4" />
            <path className="bl-robot__brows" d="M35.5 56L48 50M76.5 56L64 50" />
          </g>
        )}
      </g>
    </svg>
  );
}
