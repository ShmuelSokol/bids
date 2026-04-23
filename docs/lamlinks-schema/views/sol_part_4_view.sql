-- dbo.sol_part_4_view



/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */

/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */


/* view sol_part_4_view: add view */
CREATE VIEW [dbo].[sol_part_4_view]
AS
SELECT        dbo.kcg_tab.idsind_kcg, dbo.kcg_tab.naics1_kcg, dbo.k11_tab.idnk11_k11, dbo.kc4_tab.idnkc4_kc4, dbo.kcg_tab.idnkcg_kcg, dbo.kc4_tab.a_cage_kc4, dbo.kc4_tab.c_stat_kc4, dbo.kc4_tab.c_time_kc4, 
                         dbo.kc4_tab.cntrct_kc4, dbo.kc4_tab.rel_no_kc4, dbo.kc4_tab.reldte_kc4, dbo.kc4_tab.awdqty_kc4, dbo.kc4_tab.awd_up_kc4, dbo.kc4_tab.awd_um_kc4, dbo.k13_tab.c_name_k13 AS a_name_kc4, 
                         dbo.k13_tab.c_name_k13, dbo.kc4_tab.xmlstr_kc4, dbo.kc4_tab.k14own_kc4, dbo.k14_tab.u_name_k14 AS o_name_kc4, dbo.kc4_tab.piidno_kc4
FROM            dbo.kc4_tab INNER JOIN
                         dbo.kcg_tab ON dbo.kc4_tab.idnkc4_kc4 = dbo.kcg_tab.idnkc4_kcg INNER JOIN
                         dbo.k11_tab ON dbo.kc4_tab.idnk10_kc4 = dbo.k11_tab.idnk10_k11 AND dbo.kc4_tab.idnk08_kc4 = dbo.k11_tab.idnk08_k11 AND dbo.kcg_tab.idnk09_kcg = dbo.k11_tab.idnk09_k11 LEFT OUTER JOIN
                         dbo.k13_tab ON dbo.kc4_tab.a_cage_kc4 = dbo.k13_tab.cage_k13 LEFT OUTER JOIN
                         dbo.k14_tab ON dbo.kc4_tab.k14own_kc4 = dbo.k14_tab.idnk14_k14


















