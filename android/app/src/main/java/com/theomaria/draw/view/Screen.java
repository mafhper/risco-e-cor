package com.theomaria.draw.view;

import android.content.Context;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.theomaria.draw.AppActivity;
import com.theomaria.draw.ui.Palette;

/** Uma tela do app. Telas vivas ficam na pilha; só a do topo é anexada. */
public abstract class Screen extends FrameLayout {

    protected final AppActivity host;
    protected final Palette palette;

    protected Screen(AppActivity host) {
        super(host);
        this.host = host;
        this.palette = host.palette();
        setBackgroundColor(palette.bg);
        setLayoutParams(new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
    }

    /** Chamado quando a tela volta a ser o topo (voltar da galeria, do canvas...). */
    public void onResumeScreen() {
    }

    /** @return true quando a tela consumiu o voltar (folha aberta, por exemplo). */
    public boolean onBack() {
        return false;
    }

    protected Context context() {
        return host;
    }
}
