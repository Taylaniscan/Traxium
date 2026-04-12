export function SectionHeading({
  title
}: {
  title: string;
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold uppercase tracking-[0.08em]">{title}</h1>
    </div>
  );
}
