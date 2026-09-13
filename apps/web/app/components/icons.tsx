import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function StrokeIcon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {children}
    </svg>
  );
}

export function CloudriveLogo({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg aria-hidden="true" viewBox="0 0 32 32" className="size-7">
        <rect width="32" height="32" rx="8" fill="#2563EB" />
        <path
          d="M10.5 22.5a4.6 4.6 0 0 1-.5-9.17A6.3 6.3 0 0 1 22.4 14.4a4.1 4.1 0 0 1-.9 8.1z"
          fill="#fff"
        />
        <circle cx="16" cy="18.4" r="2.1" fill="#D97706" />
      </svg>
      <span className="text-lg font-bold tracking-tight">Cloudrive</span>
    </span>
  );
}

/* ---------- UI icons ---------- */

export function SearchIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </StrokeIcon>
  );
}

export function SyncIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </StrokeIcon>
  );
}

export function LayersIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m12 2 10 6-10 6L2 8Z" />
      <path d="m2 14 10 6 10-6" />
    </StrokeIcon>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </StrokeIcon>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </StrokeIcon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <rect width="18" height="11" x="3" y="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </StrokeIcon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M20 6 9 17l-5-5" />
    </StrokeIcon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </StrokeIcon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="m6 9 6 6 6-6" />
    </StrokeIcon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M4 6h16" />
      <path d="M4 12h16" />
      <path d="M4 18h16" />
    </StrokeIcon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </StrokeIcon>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M12 22v-5" />
      <path d="M9 8V2" />
      <path d="M15 8V2" />
      <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
    </StrokeIcon>
  );
}

export function GlobeIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </StrokeIcon>
  );
}

export function ZapIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
    </StrokeIcon>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <StrokeIcon {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
    </StrokeIcon>
  );
}

export function QuoteIcon(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11 7H7a4 4 0 0 0-4 4v6h6v-6H6a2 2 0 0 1 2-2h3V7zm10 0h-4a4 4 0 0 0-4 4v6h6v-6h-3a2 2 0 0 1 2-2h3V7z" />
    </svg>
  );
}

/* ---------- File-type glyphs (flat, colored) ---------- */

function PageGlyph({ color, children, ...props }: IconProps & { color: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M6 3.5h8L19 8.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-14A1.5 1.5 0 0 1 6.5 4z"
        fill={color}
        fillOpacity="0.18"
      />
      <path
        d="M6 3.5h8L19 8.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-14A1.5 1.5 0 0 1 6.5 4z"
        stroke={color}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.8V9h5.2" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
      {children}
    </svg>
  );
}

export function DocFileIcon(props: IconProps) {
  return (
    <PageGlyph color="#3B82F6" {...props}>
      <path d="M8.5 13h7M8.5 16.5h7" stroke="#3B82F6" strokeWidth="1.6" strokeLinecap="round" />
    </PageGlyph>
  );
}

export function SheetFileIcon(props: IconProps) {
  return (
    <PageGlyph color="#22C55E" {...props}>
      <path
        d="M8.5 12.5h7v5h-7zM8.5 15h7M11.9 12.5v5"
        stroke="#22C55E"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </PageGlyph>
  );
}

export function PdfFileIcon(props: IconProps) {
  return (
    <PageGlyph color="#EF4444" {...props}>
      <text x="12" y="17.2" textAnchor="middle" fontSize="6" fontWeight="700" fill="#EF4444">
        PDF
      </text>
    </PageGlyph>
  );
}

export function ZipFileIcon(props: IconProps) {
  return (
    <PageGlyph color="#F59E0B" {...props}>
      <path d="M12 10.5v6" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 1.6" />
      <path d="M12 16.5v1.6" stroke="#F59E0B" strokeWidth="1.6" strokeLinecap="round" />
    </PageGlyph>
  );
}

export function VideoFileIcon(props: IconProps) {
  return (
    <PageGlyph color="#8B5CF6" {...props}>
      <path d="M10.5 12.2v4.6l4-2.3z" fill="#8B5CF6" />
    </PageGlyph>
  );
}

export function ImageFileIcon(props: IconProps) {
  return (
    <PageGlyph color="#EC4899" {...props}>
      <circle cx="10" cy="13" r="1.2" fill="#EC4899" />
      <path d="m8.5 17 2.5-2.6 2 2 1.6-1.8 1.9 2.4" stroke="#EC4899" strokeWidth="1.5" strokeLinejoin="round" />
    </PageGlyph>
  );
}

/* ---------- Provider marks (flat, simplified) ---------- */

export function GoogleDriveMark(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 87.3 78" {...props}>
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="M43.65 25 29.9 1.2c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75L86.1 57.5c.8-1.4 1.2-2.95 1.2-4.5H59.798l5.852 11.5z"
        fill="#ea4335"
      />
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2H34.4c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
      <path
        d="M59.85 53.5H27.5L13.75 77.3c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.2 28.5h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );
}

export function DropboxMark(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="#0061FF"
        d="M6 1.807 0 5.629l6 3.822 6-3.822zM18 1.807 12 5.629l6 3.822 6-3.822zM0 13.274l6 3.822 6-3.822-6-3.822zM18 9.452l-6 3.822 6 3.822 6-3.822zM6 18.371l6 3.822 6-3.822-6-3.822z"
      />
    </svg>
  );
}

function CloudFill({ color, ...props }: IconProps & { color: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill={color}
        d="M13.4 6.5c-2 0-3.7 1.1-4.6 2.7-.3-.06-.66-.1-1-.1-2.2 0-4 1.8-4 4 0 .2 0 .44.05.65A3.7 3.7 0 0 0 5 20.5h13.4a3.9 3.9 0 0 0 .85-7.7 5.2 5.2 0 0 0-5.85-6.3z"
      />
    </svg>
  );
}

export function OneDriveMark(props: IconProps) {
  return <CloudFill color="#0364B8" {...props} />;
}

export function ICloudMark(props: IconProps) {
  return <CloudFill color="#3693F3" {...props} />;
}

export function S3Mark(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="#7AA116"
        d="M4.5 4.5h15v3.4h-15zM5.7 9.3h12.6l-1.15 9.1a2.1 2.1 0 0 1-2.08 1.85H8.93a2.1 2.1 0 0 1-2.08-1.85z"
      />
      <path fill="#7AA116" d="M3 3.2h18v1.1H3z" />
    </svg>
  );
}

export function BoxMark(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <path
        fill="#0061D5"
        d="M6.1 4.6 1.5 7.9l4.6 3.3L1.5 15l4.6 3.3L10.7 15v-4.5L6.1 4.6Zm11.8 0-4.6 5.9V15l4.6 3.3 4.6-3.3-4.6-3.8 4.6-3.3-4.6-3.3Z"
      />
      <path fill="#0061D5" d="m6.7 19.2 5.3 3.6 5.3-3.6-5.3-3.4z" />
    </svg>
  );
}

export function SharePointMark(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <circle cx="9" cy="9" r="6.5" fill="#038387" />
      <circle cx="16.5" cy="15" r="5.5" fill="#1A9BA1" />
      <circle cx="8.5" cy="18.5" r="4" fill="#37C6D0" />
    </svg>
  );
}

export function WebdavMark(props: IconProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" {...props}>
      <g fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </g>
    </svg>
  );
}
