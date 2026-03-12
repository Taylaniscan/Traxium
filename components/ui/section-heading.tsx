export function SectionHeading({
  title
}: {
  title: string;
}) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
    </div>
  );
}
