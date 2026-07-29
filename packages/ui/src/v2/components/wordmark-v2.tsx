import logo from "../../assets/brand/kotecode-logo.png"

export function WordmarkV2(props: { class?: string }) {
  return (
    <img
      data-component="wordmark-v2"
      src={logo}
      classList={{ [props.class ?? ""]: !!props.class }}
      alt="KoteCode"
      draggable={false}
    />
  )
}
