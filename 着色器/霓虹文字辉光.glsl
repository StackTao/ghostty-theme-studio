// Ghostty 自定义着色器：克制级霓虹文字微辉光（让深色终端高亮字产生细腻 HDR 发光质感）
// 兼容 Ghostty 1.2+ / 1.4+（Metal & OpenGL）

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    vec4 base = texture(iChannel0, uv);
    vec2 px = 1.0 / iResolution.xy;

    // 8 方向双层轻量采样，只在亮像素周围产生极细腻光晕，不糊字
    vec3 glow = vec3(0.0);
    float totalW = 0.0;

    vec2 dirs[8];
    dirs[0] = vec2( 1.0,  0.0);
    dirs[1] = vec2(-1.0,  0.0);
    dirs[2] = vec2( 0.0,  1.0);
    dirs[3] = vec2( 0.0, -1.0);
    dirs[4] = vec2( 0.707,  0.707);
    dirs[5] = vec2(-0.707,  0.707);
    dirs[6] = vec2( 0.707, -0.707);
    dirs[7] = vec2(-0.707, -0.707);

    for (int i = 0; i < 8; i++) {
        vec3 s1 = texture(iChannel0, uv + dirs[i] * px * 2.2).rgb;
        vec3 s2 = texture(iChannel0, uv + dirs[i] * px * 5.0).rgb;

        float l1 = dot(s1, vec3(0.2126, 0.7152, 0.0722));
        float l2 = dot(s2, vec3(0.2126, 0.7152, 0.0722));

        glow += s1 * smoothstep(0.32, 0.92, l1) * 1.0;
        glow += s2 * smoothstep(0.38, 0.95, l2) * 0.55;
        totalW += 1.55;
    }

    glow /= totalW;

    // 若整体偏浅色背景则自动减弱辉光，防止发白
    float bgLum = dot(iBackgroundColor, vec3(0.2126, 0.7152, 0.0722));
    float strength = mix(0.34, 0.04, smoothstep(0.25, 0.65, bgLum));

    vec3 outCol = base.rgb + glow * strength;
    fragColor = vec4(clamp(outCol, 0.0, 1.0), base.a);
}
