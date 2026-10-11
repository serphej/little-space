import { useEffect, useRef } from 'react'

export default function Modal({ title, children, onClose, wide = false }) {
  const dialog = useRef(null)
  const close = useRef(null)
  useEffect(() => {
    const previous = document.activeElement
    const element = dialog.current
    element.showModal()
    const input = element.querySelector('[data-autofocus]')
    if (input) input.focus()
    return () => { element.close(); previous?.focus() }
  }, [])
  return <dialog ref={dialog} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const box = event.currentTarget.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) onClose() } }} aria-labelledby="dialog-title">
    <div className="modal-header"><h2 id="dialog-title">{title}</h2><button className="icon-button" ref={close} onClick={onClose} aria-label="Close dialog">×</button></div>{children}
  </dialog>
}
