import { type ComponentProps } from "solid-js"

export function WordmarkV2(props: Pick<ComponentProps<"svg">, "class">) {
  return (
    <svg
      data-component="wordmark-v2"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 150"
      classList={{ [props.class ?? ""]: !!props.class }}
      role="img"
      aria-label="KoteCode"
    >
      <g transform="translate(5 10) scale(2)">
        <path
          d="M9 23 6 5l17 10.5A28 28 0 0 1 32 14a28 28 0 0 1 9 1.5L58 5l-3 18c4 5 6 11 5 18-1.8 12.6-12.8 20-28 20S5.8 53.6 4 41c-1-7 1-13 5-18Z"
          fill="#ff7300"
        />
        <path
          d="m11.5 12 2.3 12.3 9-6.4L11.5 12Zm41 0-2.3 12.3-9-6.4L52.5 12Z"
          fill="#090909"
          opacity="0.72"
        />
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
      </g>
      <text
        x="158"
        y="106"
        fill="currentColor"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="104"
        font-weight="750"
        letter-spacing="-5"
        opacity="0.78"
      >
        Kote
      </text>
      <text
        x="380"
        y="106"
        fill="#ff7300"
        font-family="Inter, ui-sans-serif, system-ui, sans-serif"
        font-size="104"
        font-weight="750"
        letter-spacing="-5"
      >
        Code
      </text>
    </svg>
  )
}
