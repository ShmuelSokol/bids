-- dbo.sol_part_5_view



/* view sol_part_5_view: add view */


/* view sol_part_5_view: add view */


/* view sol_part_5_view: add view */

/* view sol_part_5_view: add view */


/* view sol_part_5_view: add view */
/* view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view 
 view sol_part_5_view: add view */
CREATE VIEW dbo.sol_part_5_view
AS
SELECT        TOP (100) PERCENT dbo.k10_tab.sol_no_k10, dbo.k08_tab.partno_k08, dbo.k08_tab.p_cage_k08, dbo.k08_tab.p_desc_k08, dbo.k08_tab.fsc_k08, dbo.k08_tab.niin_k08, dbo.kcg_tab.prdqty_kcg, dbo.kcg_tab.optqty_kcg, 
                         dbo.kcg_tab.othqty_kcg, dbo.kcg_tab.idsind_kcg, dbo.kcg_tab.naics1_kcg, dbo.kc4_tab.c_stat_kc4, dbo.kc4_tab.c_time_kc4, dbo.kc4_tab.cntrct_kc4, dbo.kc4_tab.rel_no_kc4, dbo.kc4_tab.reldte_kc4, dbo.kc4_tab.a_cage_kc4, 
                         dbo.kc4_tab.awdqty_kc4, dbo.kc4_tab.awd_um_kc4, dbo.kc4_tab.awd_up_kc4, dbo.kcg_tab.fatqty_kcg, dbo.kcg_tab.xmlstr_kcg, dbo.k10_tab.sol_ti_k10, dbo.k10_tab.isudte_k10, dbo.k10_tab.closes_k10, 
                         dbo.k08_tab.idnk08_k08, dbo.k10_tab.idnk10_k10, dbo.kc4_tab.idnkc4_kc4, dbo.kcg_tab.idnkcg_kcg, dbo.kc4_tab.piidno_kc4
FROM            dbo.kc4_tab INNER JOIN
                         dbo.k08_tab ON dbo.kc4_tab.idnk08_kc4 = dbo.k08_tab.idnk08_k08 INNER JOIN
                         dbo.k10_tab ON dbo.kc4_tab.idnk10_kc4 = dbo.k10_tab.idnk10_k10 INNER JOIN
                         dbo.kcg_tab ON dbo.kc4_tab.idnkc4_kc4 = dbo.kcg_tab.idnkc4_kcg
ORDER BY dbo.kcg_tab.idnkcg_kcg DESC





