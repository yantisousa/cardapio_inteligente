import './TriunfoBrand.css'

export function TriunfoLogo({ className = '' }) {
  return <svg className={`triunfo-logo ${className}`} viewBox="180 160 2265 930" width="190" height="78" role="img" aria-label="Triunfo Menu">
    {/* Only transparent padding is cropped; the official image is unchanged. */}
    <image href="/triunfo-menu-logo.png" width="2778" height="1250" />
  </svg>
}

export function TriunfoMark({ className = '' }) {
  return <img className={`triunfo-mark ${className}`} src="/triunfo-mark.svg" width="48" height="48" alt="" />
}
