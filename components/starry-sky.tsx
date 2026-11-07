'use client'

import { useEffect, useRef } from 'react'

export function StarrySky() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    let width = 0
    let height = 0
    let animationFrame = 0
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    type Star = { x: number; y: number; radius: number; depth: number; phase: number; speed: number }
    let stars: Star[] = []
    const shootingStars: { x: number; y: number; vx: number; vy: number; life: number }[] = []

    const resize = () => {
      const ratio = window.devicePixelRatio || 1
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = width * ratio
      canvas.height = height * ratio
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      stars = Array.from({ length: Math.min(420, Math.floor((width * height) / 2600)) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.35 + 0.2,
        depth: Math.random() * 3 + 0.5,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.005,
      }))
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer.targetX = (event.clientX / width - 0.5) * 2
      pointer.targetY = (event.clientY / height - 0.5) * 2
    }
    const onClick = (event: MouseEvent) => {
      if (!reducedMotion) shootingStars.push({ x: event.clientX, y: event.clientY, vx: 7, vy: 3, life: 1 })
    }

    const draw = () => {
      pointer.x += (pointer.targetX - pointer.x) * 0.04
      pointer.y += (pointer.targetY - pointer.y) * 0.04
      context.clearRect(0, 0, width, height)
      for (const star of stars) {
        star.phase += star.speed
        const alpha = 0.28 + Math.sin(star.phase) * 0.3 + 0.3
        const x = (star.x - pointer.x * star.depth * 8 + width) % width
        const y = (star.y - pointer.y * star.depth * 8 + height) % height
        context.globalAlpha = alpha
        context.fillStyle = star.radius > 1.15 ? '#e8b8ff' : '#fff5ff'
        context.beginPath()
        context.arc(x, y, star.radius, 0, Math.PI * 2)
        context.fill()
        if (star.radius > 1.2) {
          context.globalAlpha = alpha * 0.2
          context.beginPath()
          context.arc(x, y, star.radius * 4, 0, Math.PI * 2)
          context.fill()
        }
      }
      if (!reducedMotion && Math.random() < 0.003) shootingStars.push({ x: Math.random() * width * 0.7, y: Math.random() * height * 0.4, vx: 8, vy: 3.5, life: 1 })
      for (let index = shootingStars.length - 1; index >= 0; index -= 1) {
        const meteor = shootingStars[index]
        const gradient = context.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 12, meteor.y - meteor.vy * 12)
        gradient.addColorStop(0, `rgba(255,255,255,${meteor.life})`)
        gradient.addColorStop(1, 'rgba(255,255,255,0)')
        context.globalAlpha = 1
        context.strokeStyle = gradient
        context.lineWidth = 2
        context.beginPath()
        context.moveTo(meteor.x, meteor.y)
        context.lineTo(meteor.x - meteor.vx * 12, meteor.y - meteor.vy * 12)
        context.stroke()
        meteor.x += meteor.vx
        meteor.y += meteor.vy
        meteor.life -= 0.015
        if (meteor.life <= 0) shootingStars.splice(index, 1)
      }
      animationFrame = requestAnimationFrame(draw)
    }

    resize()
    draw()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('click', onClick)
    return () => {
      cancelAnimationFrame(animationFrame)
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('click', onClick)
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="starry-canvas" />
}
