// Ghostty 自定义着色器：复古 CRT 磷光微扫描线 + 暗角（无眩晕畸变，长时间可读）
// 兼容 Ghostty 1.2+ / 1.4+（Metal & OpenGL）

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec2 px = 1.0 / iResolution.xy;

    // 极微弱的水平色散与磷光发散
    float r = texture(iChannel0, uv + vec2(px.x * 0.7, 0.0)).r;
    float g = texture(iChannel0, uv).g;
    float b = texture(iChannel0, uv - vec2(px.x * 0.7, 0.0)).b;
    vec4 base = texture(iChannel0, uv);
    vec3 col = vec3(r, g, b);

    // 柔和磷光溢出
    vec3 blur = (
        texture(iChannel0, uv + vec2(px.x * 2.0, 0.0)).rgb +
        texture(iChannel0, uv - vec2(px.x * 2.0, 0.0)).rgb +
        texture(iChannel0, uv + vec2(0.0, px.y * 2.0)).rgb +
        texture(iChannel0, uv - vec2(0.0, px.y * 2.0)).rgb
    ) * 0.25;
    float lum = dot(blur, vec3(0.2126, 0.7152, 0.0722));
    col += blur * smoothstep(0.25, 0.9, lum) * 0.24;

    // 细腻横向扫描线
    float scan = 0.935 + 0.065 * sin(fragCoord.y * 1.55);
    col *= scan;

    // 柔润电影感四周暗角
    vec2 centered = uv * 2.0 - 1.0;
    float vig = 1.0 - dot(centered * vec2(0.65, 0.75), centered * vec2(0.65, 0.75)) * 0.22;
    col *= clamp(vig, 0.72, 1.0);

    fragColor = vec4(clamp(col, 0.0, 1.0), base.a);
}
