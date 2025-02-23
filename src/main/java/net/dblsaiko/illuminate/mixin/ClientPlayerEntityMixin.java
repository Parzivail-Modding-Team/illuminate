package net.dblsaiko.illuminate.mixin;

import net.dblsaiko.illuminate.client.LightSource;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(ClientPlayerEntity.class)
public abstract class ClientPlayerEntityMixin {
    @Shadow
    @Final
    protected MinecraftClient client;

    @Inject(method = "isMainPlayer()Z", at = @At("HEAD"), cancellable = true)
    private void isMainPlayer(CallbackInfoReturnable<Boolean> cir) {
        // make our player render when the camera is a LightSource
        if (this.client.getCameraEntity() instanceof LightSource ls && ls.getLight().selfPlayerShadow()) {
            cir.setReturnValue(false);
        }
    }
}
