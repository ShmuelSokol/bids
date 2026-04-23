-- dbo.solicitation_line_1_view



/* view solicitation_line_1_view: add view */


/* view solicitation_line_1_view: add view */


/* view solicitation_line_1_view: add view */

/* view solicitation_line_1_view: add view */


/* view solicitation_line_1_view: add view */
/* view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view 
 view solicitation_line_1_view: add view */
CREATE VIEW dbo.solicitation_line_1_view
AS
SELECT DISTINCT 
                         dbo.solicitation_identity_1_view.idnk11_k11 AS idnk11_frm, dbo.kc4_tab.idnkc4_kc4, dbo.k08_tab.partno_k08, dbo.k08_tab.partrv_k08, dbo.k08_tab.p_cage_k08, dbo.k08_tab.p_desc_k08, dbo.k08_tab.fsc_k08, 
                         dbo.k08_tab.niin_k08, dbo.k11_tab.pr_num_k11, dbo.k09_tab.source_k09, dbo.k10_tab.sol_no_k10, dbo.k08_tab.idnk08_k08, dbo.k09_tab.idnk09_k09, dbo.k10_tab.idnk10_k10, dbo.k11_tab.idnk11_k11, dbo.k10_tab.idnk31_k10, 
                         dbo.k08_tab.weight_k08, dbo.k09_tab.ref_no_k09, dbo.k09_tab.refdte_k09, dbo.k10_tab.sol_ti_k10, dbo.k10_tab.isudte_k10, dbo.k10_tab.closes_k10, dbo.k10_tab.saside_k10, dbo.k11_tab.estval_k11, dbo.k11_tab.solqty_k11, 
                         dbo.k11_tab.prdqty_k11, dbo.k11_tab.fatqty_k11, dbo.k11_tab.sol_um_k11, dbo.k11_tab.qupcod_k11, dbo.k11_tab.itemno_k11, dbo.k11_tab.idnk21_k11, dbo.k11_tab.fobcod_k11, dbo.k11_tab.amcode_k11, 
                         dbo.k11_tab.picode_k11, dbo.k21_tab.idnk21_k21, dbo.k21_tab.slcnam_k21, dbo.k11_tab.acqdes_k11, dbo.k11_tab.amcdes_k11, dbo.k10_tab.bq_sta_k10
FROM            dbo.solicitation_identity_1_view INNER JOIN
                         dbo.kc4_tab ON dbo.solicitation_identity_1_view.idnkc4_kc4 = dbo.kc4_tab.idnkc4_kc4 INNER JOIN
                         dbo.k11_tab ON dbo.kc4_tab.idnk08_kc4 = dbo.k11_tab.idnk08_k11 AND dbo.kc4_tab.idnk10_kc4 = dbo.k11_tab.idnk10_k11 INNER JOIN
                         dbo.k09_tab ON dbo.k11_tab.idnk09_k11 = dbo.k09_tab.idnk09_k09 INNER JOIN
                         dbo.k08_tab ON dbo.k11_tab.idnk08_k11 = dbo.k08_tab.idnk08_k08 INNER JOIN
                         dbo.k10_tab ON dbo.kc4_tab.idnk10_kc4 = dbo.k10_tab.idnk10_k10 INNER JOIN
                         dbo.k21_tab ON dbo.k11_tab.idnk21_k11 = dbo.k21_tab.idnk21_k21





