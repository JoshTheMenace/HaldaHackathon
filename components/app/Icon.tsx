// Material Symbols icon. The font is loaded in the root layout.
export function Icon({ name, className }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined${className ? " " + className : ""}`}>{name}</span>;
}
