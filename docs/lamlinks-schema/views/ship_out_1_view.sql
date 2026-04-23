-- dbo.ship_out_1_view



/* view ship_out_1_view: add view */


/* view ship_out_1_view: add view */


/* view ship_out_1_view: add view */

/* view ship_out_1_view: add view */


/* view ship_out_1_view: add view */


/* view ship_out_1_view: add view */


/* view ship_out_1_view: add view */


/* view ship_out_1_view: add view */


/* view ship_out_1_view: add view */
CREATE VIEW [dbo].[ship_out_1_view]
AS
SELECT        dbo.kcu_tab.sprtyp_kcu, dbo.kcu_tab.sprnum_kcu, dbo.kcu_tab.ormnum_kcu, dbo.kcu_tab.srssta_kcu, dbo.kcu_tab.srsdte_kcu, dbo.kcw_tab.cactyp_kcw, dbo.kcw_tab.cactno_kcw, dbo.kcu_tab.idnkcu_kcu, 
                         dbo.kcw_tab.idnkcw_kcw, dbo.kcw_tab.cark12_kcw, dbo.kcw_tab.cack12_kcw, dbo.kcw_tab.viakap_kcw, dbo.kcw_tab.typkap_kcw
FROM            dbo.kcu_tab INNER JOIN
                         dbo.kcw_tab ON dbo.kcu_tab.idnkcw_kcu = dbo.kcw_tab.idnkcw_kcw









