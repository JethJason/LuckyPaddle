export default function Clover({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="currentColor">
      <path d="M12 12c.2 4 .9 7 3.4 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      {[0, 90, 180, 270].map((r) => (
        <path
          key={r}
          transform={`rotate(${r} 12 12)`}
          d="M12 12c0-4.5-2.5-7-5.5-7S3 8.5 6.5 11C3 13.5 3.5 17 6.5 17 9.5 17 12 14.5 12 12Z"
        />
      ))}
    </svg>
  );
}
