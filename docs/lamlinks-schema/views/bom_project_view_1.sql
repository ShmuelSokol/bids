-- dbo.bom_project_view_1



/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */

/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */


/* view bom_project_view_1: add view */
CREATE VIEW [dbo].[bom_project_view_1]
AS
SELECT     dbo.k73_tab.prjnam_k73, dbo.k73_tab.minqty_k73, dbo.k73_tab.midqty_k73, dbo.k73_tab.maxqty_k73, dbo.kd2_tab.adtime_kd2, dbo.kd2_tab.bverno_kd2, 
                      dbo.kd2_tab.bv_num_kd2, dbo.kd2_tab.bvdesc_kd2, dbo.kd2_tab.bvstat_kd2, dbo.part_2_view.prtnum_k71, dbo.part_2_view.pn_rev_k71, 
                      dbo.part_2_view.p_desc_k71, dbo.part_2_view.p_desc_k08, dbo.part_2_view.fsc_k08, dbo.part_2_view.p_um_k71, dbo.part_2_view.niin_k08, 
                      dbo.k73_tab.addtme_k73, dbo.part_2_view.e_code_mfg AS cage_k13, dbo.part_2_view.idnk08_k08, dbo.k73_tab.idnk11_k73, dbo.part_2_view.idnk13_k13, 
                      dbo.part_2_view.idnk13_k13 AS idnk13_k71, dbo.part_2_view.idnk71_k71, dbo.k73_tab.idnk73_k73, dbo.kd2_tab.idnkd2_kd2
FROM         dbo.k73_tab INNER JOIN
                      dbo.kd2_tab ON dbo.k73_tab.idnkd2_k73 = dbo.kd2_tab.idnkd2_kd2 INNER JOIN
                      dbo.part_2_view ON dbo.kd2_tab.idnk71_kd2 = dbo.part_2_view.idnk71_k71


















