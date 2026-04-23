-- dbo.bom_comp_view_1



/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */

/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */


/* view bom_comp_view_1: add view */
CREATE VIEW [dbo].[bom_comp_view_1]
AS
SELECT     component_part_view.prtnum_k71, component_part_view.pn_rev_k71, component_part_view.p_desc_k71 AS p_desc_cmp, component_part_view.fsc_k08, 
                      component_part_view.niin_k08, component_part_view.p_desc_k08, component_part_view.e_code_mfg AS m_code_cmp, 
                      component_part_view.e_name_mfg AS m_name_cmp, component_part_view.p_um_k71, component_part_view.cmpcnt_k71, component_part_view.nhacnt_k71, 
                      component_part_view.idnk08_k08, component_part_view.idnk71_k71, dbo.bom_ver_view_1.idncmp_k72, dbo.bom_ver_view_1.idnnha_k72, 
                      dbo.bom_ver_view_1.seq_no_k72, dbo.bom_ver_view_1.itemno_k72, dbo.bom_ver_view_1.cmpqty_k72, dbo.bom_ver_view_1.qtyper_k72, 
                      dbo.bom_ver_view_1.idnk72_k72, component_part_view.idnk13_k13, component_part_view.e_code_mfg AS cage_k13, 
                      component_part_view.e_name_mfg AS c_name_k13, dbo.bom_ver_view_1.idnkd2_kd2, dbo.bom_ver_view_1.adtime_kd2, dbo.bom_ver_view_1.bverno_kd2, 
                      dbo.bom_ver_view_1.bv_num_kd2, dbo.bom_ver_view_1.bvdesc_kd2, dbo.bom_ver_view_1.bvstat_kd2
FROM         dbo.bom_ver_view_1 INNER JOIN
                      dbo.part_2_view AS component_part_view ON dbo.bom_ver_view_1.idncmp_k72 = component_part_view.idnk71_k71


















