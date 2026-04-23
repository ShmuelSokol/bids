-- dbo.bom_view_1



/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */

/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */


/* view bom_view_1: add view */
CREATE VIEW [dbo].[bom_view_1]
AS
SELECT     assembly_part_view.fsc_k08 AS fsc_asy, assembly_part_view.niin_k08 AS niin_asy, assembly_part_view.prtnum_k71 AS prtnum_asy, 
                      assembly_part_view.p_desc_k71 AS p_desc_asy, assembly_part_view.e_code_mfg AS m_cage_asy, assembly_part_view.e_name_mfg AS m_name_asy, 
                      component_part_view.fsc_k08 AS fsc_cmp, component_part_view.niin_k08 AS niin_cmp, component_part_view.prtnum_k71 AS prtnum_cmp, 
                      component_part_view.p_desc_k71 AS p_desc_cmp, component_part_view.e_code_mfg AS m_cage_cmp, component_part_view.e_name_mfg AS m_name_cmp, 
                      dbo.bom_project_view_1.prjnam_k73, dbo.bom_project_view_1.adtime_kd2, dbo.bom_project_view_1.bv_num_kd2, dbo.bom_project_view_1.bvstat_kd2, 
                      dbo.bom_project_view_1.fsc_k08 AS fsc_top, dbo.bom_project_view_1.niin_k08 AS niin_top, dbo.bom_project_view_1.cage_k13 AS m_cage_top, 
                      dbo.bom_project_view_1.prtnum_k71 AS prtnum_top, dbo.bom_project_view_1.p_desc_k71 AS p_desc_top, dbo.bom_project_view_1.idnk71_k71 AS idnk71_top, 
                      assembly_part_view.idnk71_k71 AS idnk71_asy, component_part_view.idnk71_k71 AS idnk71_cmp, dbo.k72_tab.idnk72_k72, dbo.bom_project_view_1.idnk73_k73, 
                      dbo.bom_project_view_1.idnkd2_kd2, dbo.k72_tab.seq_no_k72, dbo.k72_tab.itemno_k72, dbo.k72_tab.cmpqty_k72, dbo.k72_tab.qtyper_k72
FROM         dbo.part_2_view AS assembly_part_view INNER JOIN
                      dbo.k72_tab ON assembly_part_view.idnk71_k71 = dbo.k72_tab.idnnha_k72 INNER JOIN
                      dbo.part_2_view AS component_part_view ON dbo.k72_tab.idncmp_k72 = component_part_view.idnk71_k71 INNER JOIN
                      dbo.bom_project_view_1 ON dbo.k72_tab.idnkd2_k72 = dbo.bom_project_view_1.idnkd2_kd2


















