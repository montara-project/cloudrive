import { cn } from '@/lib/utils'

/**
 * FolderArt is the authored folder illustration used by the Frequently
 * Access grid — a closed folder with a sheet of paper peeking out, drawn as
 * crisp vector geometry with soft gradients so it reads dimensional without
 * being a bitmap asset.
 */
export default function FolderArt({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 104"
      fill="none"
      aria-hidden="true"
      className={cn('h-auto w-full', className)}
    >
      <defs>
        <linearGradient
          id="folder-front"
          x1="60"
          y1="44"
          x2="60"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FCD34D" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient
          id="folder-back"
          x1="60"
          y1="24"
          x2="60"
          y2="92"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F59E0B" />
          <stop offset="1" stopColor="#D97706" />
        </linearGradient>
        <filter
          id="folder-shadow"
          x="12"
          y="88"
          width="96"
          height="16"
          filterUnits="userSpaceOnUse"
        >
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* ground shadow */}
      <ellipse
        cx="60"
        cy="95"
        rx="40"
        ry="5"
        fill="#0F172A"
        opacity="0.14"
        filter="url(#folder-shadow)"
      />

      {/* paper sheet peeking out of the folder */}
      <rect
        x="30"
        y="18"
        width="62"
        height="34"
        rx="5"
        fill="#FFFFFF"
        stroke="#E4E4E7"
        strokeWidth="1.5"
      />
      <rect x="38" y="27" width="34" height="4" rx="2" fill="#E4E4E7" />
      <rect x="38" y="36" width="46" height="4" rx="2" fill="#F4F4F5" />

      {/* back panel with tab */}
      <path
        d="M20 24h20c2.6 0 5 1.2 6.6 3.2l3.2 4.2c1.5 2 3.9 3.2 6.4 3.2h44c4.4 0 8 3.6 8 8v41c0 4.4-3.6 8-8 8H20c-4.4 0-8-3.6-8-8V32c0-4.4 3.6-8 8-8Z"
        fill="url(#folder-back)"
      />

      {/* front panel */}
      <path
        d="M14 44h92c4.4 0 8 3.6 8 8v36c0 4.4-3.6 8-8 8H14c-4.4 0-8-3.6-8-8V52c0-4.4 3.6-8 8-8Z"
        fill="url(#folder-front)"
      />
      {/* top-edge highlight on the front panel */}
      <rect x="14" y="44" width="92" height="3" rx="1.5" fill="#FFFFFF" opacity="0.35" />
    </svg>
  )
}
