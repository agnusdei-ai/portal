export function StepShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-lg text-ink-soft">{intro}</p>
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}
