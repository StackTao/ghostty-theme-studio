// Ghostty 自定义着色器：极光呼吸流光边框（仅在窗口极边缘柔和发光，完全不遮文字）
// 兼容 Ghostty 1.2+ / 1.4+（Metal & OpenGL）

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 base = texture(iChannel0, uv);

    // 计算当前像素到四条边缘的最小距离（像素单位）
    float edgeLeft = fragCoord.x;
    float edgeRight = iResolution.x - fragCoord.x;
    float edgeBottom = fragCoord.y;
    float edgeTop = iResolution.y - fragCoord.y;
    float distToEdge = min(min(edgeLeft, edgeRight), min(edgeBottom, edgeTop));

    // 极细发光描边 + 柔和内晕（仅占最外侧 22px）
    float borderLine = smoothstep(3.0, 0.0, distToEdge);
    float softGlow = exp(-distToEdge / 14.0) * 0.26;

    // 沿窗口周长缓慢流动的极光三色渐变
    vec2 centered = uv - 0.5;
    float angle = atan(centered.y, centered.x);
    float wave1 = 0.5 + 0.5 * sin(angle * 2.0 + iTime * 0.85);
    float wave2 = 0.5 + 0.5 * sin(angle * 2.0 - iTime * 0.6 + 2.1);

    vec3 c1 = vec3(0.38, 0.85, 0.98); // 极光青
    vec3 c2 = vec3(0.68, 0.48, 1.00); // 魅紫
    vec3 c3 = vec3(0.98, 0.44, 0.72); // 玫瑰粉
    vec3 aurora = mix(mix(c1, c2, wave1), c3, wave2 * 0.65);

    // 窗口失焦时降低发光强度，保持克制优雅
    float focusScale = (iFocus > 0) ? 1.0 : 0.25;
    float intensity = (borderLine * 0.58 + softGlow) * focusScale;

    vec3 col = base.rgb + aurora * intensity;
    fragColor = vec4(clamp(col, 0.0, 1.0), base.a);
}
