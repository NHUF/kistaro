export function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-gray-800/70">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">{label}</p>
      <p className="mt-1 break-all text-sm text-gray-700 dark:text-gray-200">{value}</p>
    </div>
  );
}
