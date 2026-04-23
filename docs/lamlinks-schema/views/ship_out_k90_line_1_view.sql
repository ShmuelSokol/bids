-- dbo.ship_out_k90_line_1_view



/* view ship_out_k90_line_1_view: add view */


/* view ship_out_k90_line_1_view: add view */


/* view ship_out_k90_line_1_view: add view */

/* view ship_out_k90_line_1_view: add view */


/* view ship_out_k90_line_1_view: add view */


/* view ship_out_k90_line_1_view: add view */


/* view ship_out_k90_line_1_view: add view */


/* view ship_out_k90_line_1_view: add view */


/* view ship_out_k90_line_1_view: add view */
CREATE VIEW [dbo].[ship_out_k90_line_1_view]
AS
SELECT        dbo.ship_out_line_1_view.sprtyp_kcu, dbo.ship_out_line_1_view.sprnum_kcu, dbo.ship_out_line_1_view.rtnsta_kcv, dbo.ship_out_line_1_view.srlqty_kcv, dbo.ship_out_line_1_view.ormnum_kcu, 
                         dbo.ship_out_line_1_view.srssta_kcu, dbo.ship_out_line_1_view.srsdte_kcu, dbo.ship_out_line_1_view.cactyp_kcw, dbo.ship_out_line_1_view.cactno_kcw, dbo.ship_out_line_1_view.afttab_kcv, 
                         dbo.ship_out_line_1_view.idnaft_kcv, dbo.ship_out_line_1_view.idnkcv_kcv, dbo.ship_out_line_1_view.idnkcu_kcu, dbo.ship_out_line_1_view.idnkcw_kcw, dbo.po_line_1_view.por_no_k89, 
                         dbo.po_line_1_view.s_code_k39, dbo.po_line_1_view.e_name_k12
FROM            dbo.ship_out_line_1_view INNER JOIN
                         dbo.po_line_1_view ON dbo.ship_out_line_1_view.idnaft_kcv = dbo.po_line_1_view.idnk90_k90
WHERE        (dbo.ship_out_line_1_view.afttab_kcv = 'k90')









