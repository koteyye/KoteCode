import { type ComponentProps } from "solid-js"

import icon from "../assets/brand/kotecode-icon.png"
import logo from "../assets/brand/kotecode-logo.png"

export const Mark = (props: { class?: string }) => {
  return (
    <img
      data-component="logo-mark"
      src={icon}
      classList={{ [props.class ?? ""]: !!props.class }}
      alt="KoteCode"
      draggable={false}
    />
  )
}

export const Splash = (props: Pick<ComponentProps<"img">, "ref" | "class">) => {
  return (
    <img
      ref={props.ref}
      data-component="logo-splash"
      src={icon}
      classList={{ [props.class ?? ""]: !!props.class }}
      alt="KoteCode"
      draggable={false}
    />
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <img
      data-component="logo-wordmark"
      src={logo}
      classList={{ [props.class ?? ""]: !!props.class }}
      alt="KoteCode"
      draggable={false}
    />
  )
}
