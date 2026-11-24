package com.cordova.newfocus;

import android.graphics.drawable.ColorDrawable;
import android.os.Bundle;
import android.view.View;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        pintarFaixaDaBarraDeStatus();
    }

    // Em WebView < 140 o Capacitor não deixa a página desenhar sob as barras do sistema: ele dá
    // padding na decor view e a faixa mostra o windowBackground (creme). No Android 15+ a cor da
    // barra de status não pode mais ser definida, então a faixa de cima é pintada aqui. Em WebView
    // novo o padding é zero e nada é desenhado: a própria página cobre a área.
    private void pintarFaixaDaBarraDeStatus() {
        View decor = getWindow().getDecorView();
        ColorDrawable faixa = new ColorDrawable(ContextCompat.getColor(this, R.color.marinho));
        decor.getOverlay().add(faixa);
        decor.addOnLayoutChangeListener((v, l, t, r, b, ol, ot, or, ob) ->
            faixa.setBounds(0, 0, r - l, v.getPaddingTop())
        );
    }
}
