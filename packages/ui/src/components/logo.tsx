import { type ComponentProps } from "solid-js"

const CatCodeGlyph = () => (
  <>
    <path
      d="M9 23 6 5l17 10.5A28 28 0 0 1 32 14a28 28 0 0 1 9 1.5L58 5l-3 18c4 5 6 11 5 18-1.8 12.6-12.8 20-28 20S5.8 53.6 4 41c-1-7 1-13 5-18Z"
      fill="#ff7300"
    />
    <path d="m11.5 12 2.3 12.3 9-6.4L11.5 12Zm41 0-2.3 12.3-9-6.4L52.5 12Z" fill="#090909" opacity="0.72" />
    <path
      d="m26 27-6 5 6 5m12-10 6 5-6 5m-3-12-6 14"
      fill="none"
      stroke="#090909"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path d="m28.5 44 3.5-2 3.5 2-3.5 3-3.5-3Z" fill="#090909" />
    <path
      d="M32 46.5V49m0 0c-2.8 3.3-6.2 3.5-9 1.2M32 49c2.8 3.3 6.2 3.5 9 1.2"
      fill="none"
      stroke="#090909"
      stroke-width="2.4"
      stroke-linecap="round"
    />
  </>
)

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="KoteCode"
    >
      <CatCodeGlyph />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="KoteCode"
    >
      <CatCodeGlyph />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-wordmark"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 276 64"
      classList={{ [props.class ?? ""]: !!props.class }}
      role="img"
      aria-label="KoteCode"
    >
      <CatCodeGlyph />
      <text
        x="76"
        y="43"
        fill="var(--icon-strong-base)"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="38"
        font-weight="750"
        letter-spacing="-1.8"
      >
        Kote
      </text>
      <text
        x="163"
        y="43"
        fill="#ff7300"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="38"
        font-weight="750"
        letter-spacing="-1.8"
      >
        Code
      </text>
    </svg>
  )
}
