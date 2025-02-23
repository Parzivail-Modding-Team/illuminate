#version 400 core

uniform int width;
uniform int height;

// The accumulator buffer, contains previous output of this shader in case
// multiple passes are necessary.
uniform sampler2D accum;

// Player camera's depth buffer.
uniform sampler2D depth;

uniform sampler2D[MAX_LIGHTS] texTable;

// Lights' projected texture, depth buffer, MVP matrix and position.
// MAX_LIGHTS defined based on what the graphics driver supports. See Shaders::readShader.
uniform int[MAX_LIGHTS] lightTex;
uniform int[MAX_LIGHTS] lightDepth;
uniform mat4[MAX_LIGHTS] lightCam;
uniform vec3[MAX_LIGHTS] lightPos;
uniform float[MAX_LIGHTS] lightBrightness;

// The current amount of lights. Less or equal to MAX_LIGHTS.
uniform int lightCount;

// Transforms screen coordinates (range -1..1) to texture coordinates (range 0..1).
uniform mat4 screen2tex = mat4(
    0.5, 0, 0, 0,
    0, 0.5, 0, 0,
    0, 0, 0.5, 0,
    0.5, 0.5, 0.5, 1
);

uniform mat4 camInv;

in vec2 f_uv;

out vec4 color;

// Returns whether the specified (clip-space) position is inside the clip box, i.e. visible on screen.
bool isInBox(in vec3 v) {
    return
        v.x >= -1 && v.x <= 1 &&
        v.y >= -1 && v.y <= 1 &&
        v.z >= -1 && v.z <= 1;
}

vec2 uvToXy(in vec2 uv) {
    return uv * 2 - 1;
}

// Calculates a position in the world from screen coordinates plus the associated value in the depth buffer.
vec3 toWorldCoords(in vec2 screen, in float depth) {
    vec4 c = vec4(screen, depth, 1);
    vec4 r = camInv * c;

    return r.xyz / r.w;
}

// Calculates a position in the world from depth buffer coordinates.
vec3 toWorldCoords(in vec2 depthCoords) {
    float d = texture(depth, depthCoords).x * 2 - 1;
    return toWorldCoords(uvToXy(depthCoords), d);
}

// Calculates the (world-space) normal vector for the specified position on screen. This samples the depth buffer
// multiple times which introduces artifacts on sharp edges, but is realistically the best we can do from a
// post-processing shader.
vec3 getNormal(in vec2 depthCoords) {
    vec2 scd = vec2(width, height);
    vec3 a = toWorldCoords(depthCoords + (vec2( 1,  0) / scd));
    vec3 b = toWorldCoords(depthCoords + (vec2(-1, -1) / scd));
    vec3 c = toWorldCoords(depthCoords + (vec2(-1,  1) / scd));

    return -normalize(cross(b - a, c - a));
}

void main() {
    // First, get the coordinates in the world of the fragment we're currently processing.
    vec3 worldCoords = toWorldCoords(f_uv);

    // The color of this fragment in the current screen buffer.
    vec3 accumFrag = texture(accum, f_uv).xyz;

    // The (world-space) normal vector of the current fragment.
    vec3 normal = getNormal(f_uv);

    for (int i = 0; i < lightCount; i++) {
        vec3 dir = lightPos[i] - worldCoords;

        // Intensity multiplier based on angle of impact.
        float lmul = clamp(dot(normalize(dir), normal), 0, 1);

        // How far away is this fragment from the light?
        float dist = length(dir);

        // The corresponding clip-space coordinates and z-buffer texture coordinates of this fragment for the light.
        vec4 v = lightCam[i] * vec4(worldCoords, 1);
        vec4 tex = screen2tex * v;
        vec3 lightCamCoords = v.xyz / v.w;
        vec2 texCoords = tex.xy / tex.w;

        // The distance of what the light actually sees on the line between its near/far plane going through
        float ld = texture(texTable[lightDepth[i]], texCoords).x * 2 - 1;

        // If these coordinates could be seen from the light's perspective (it is inside its clip bounds and there's
        // nothing in front of it based on the value in the depth buffer), add the color from our light texture to the \
        // buffer, intensity adjusted based on angle of impact and distance from the light.
        if (isInBox(lightCamCoords) && lightCamCoords.z <= ld + 0.001) {
            vec4 texColor = texture(texTable[lightTex[i]], texCoords * vec2(1, -1));
            accumFrag += vec3(texColor.xyz * texColor.w * lightBrightness[i] * lmul * (1 / pow(dist, 1.5)));
        }
    }

    color = vec4(accumFrag, 1);
}
