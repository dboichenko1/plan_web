// Пустое состояние: только типографика, без картинок.
// Заголовок и подсказка выровнены влево и отцентрованы по вертикали,
// действие — текстовая кнопка акцентным цветом.

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string
  hint: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="flex h-full flex-col justify-center px-6">
      <div className="text-15 text-text-muted">{title}</div>
      <div className="mt-2 text-pretty text-13 text-text-quiet">{hint}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="-ml-2 mt-1.5 flex h-11 items-center self-start px-2 text-15 font-medium text-accent"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
